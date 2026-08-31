import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';
import PipelineFailure from '../models/PipelineFailure.js';
import AnalysisResult from '../models/AnalysisResult.js';
import AppliedFix from '../models/AppliedFix.js';
import CICDService from '../services/cicdService.js';
import LogParser from '../services/logParser.js';
import { getQueues } from '../queues/index.js';

class AnalyzeController {
  /**
   * Receive and queue a pipeline failure for analysis
   * Supports multiple CI/CD providers
   */
  static async submitFailure(req, res) {
    try {
      const { logs, pipelineId, pipelineName, cicdProvider, ...otherData } =
        req.body;

      // Validate required fields
      if (!logs || !pipelineId) {
        return res.status(400).json({
          error: 'Missing required fields: logs, pipelineId',
        });
      }

      // Create pipeline failure record
      const failure = new PipelineFailure({
        pipelineId,
        pipelineName: pipelineName || 'Unknown Pipeline',
        cicdProvider: cicdProvider || 'unknown',
        commitSha: otherData.commitSha || 'unknown',
        commitAuthor: otherData.commitAuthor,
        repositoryUrl: otherData.repositoryUrl,
        branch: otherData.branch,
        logs: {
          raw: logs,
          truncated: logs.length > 8000,
          size: logs.length,
        },
        failureType: otherData.failureType || 'unknown',
        webhookPayload: otherData.webhookPayload,
        status: 'pending-analysis',
      });

      const saved = await failure.save();
      logger.info(
        { failureId: saved._id, pipelineId },
        'Pipeline failure recorded'
      );

      // Queue for analysis
      const queues = await getQueues();
      const job = await queues.analysisQueue.add(
        'analyze-failure',
        {
          failureId: saved._id,
          context: {
            repositoryUrl: failure.repositoryUrl,
            branch: failure.branch,
            commitSha: failure.commitSha,
          },
        },
        {
          jobId: uuidv4(),
          priority: failure.failureType === 'critical' ? 10 : 5,
        }
      );

      logger.info({ jobId: job.id }, 'Analysis job queued');

      return res.status(202).json({
        success: true,
        failureId: saved._id.toString(),
        jobId: job.id,
        message: 'Failure submitted for analysis',
        status: 'queued',
      });
    } catch (error) {
      logger.error({ err: error }, 'Error submitting failure');
      return res.status(500).json({
        error: 'Failed to submit failure for analysis',
        details: error.message,
      });
    }
  }

  /**
   * Receive failure via webhook (GitHub Actions, Jenkins, GitLab, etc.)
   */
  static async receiveWebhook(req, res) {
    try {
      // Detect provider
      const provider = CICDService.detectProvider(req.headers, req.body);
      logger.info({ provider }, 'Webhook received');

      let failureData;

      // Validate and parse based on provider
      switch (provider) {
        case 'github-actions':
          // Validate signature
          const signature = req.headers['x-hub-signature-256'];
          if (
            signature &&
            !CICDService.validateGitHubWebhook(
              req.rawBody,
              signature
            )
          ) {
            return res.status(401).json({ error: 'Invalid signature' });
          }
          failureData = CICDService.parseGitHubPayload(req.body);
          break;

        case 'jenkins':
          failureData = CICDService.parseJenkinsPayload(req.body);
          break;

        case 'gitlab-ci':
          failureData = CICDService.parseGitLabPayload(req.body);
          break;

        default:
          logger.warn({ provider }, 'Unknown CI/CD provider');
          failureData = {
            pipelineId: 'unknown',
            pipelineName: 'Unknown',
            cicdProvider: 'unknown',
            logs: JSON.stringify(req.body),
            webhookPayload: req.body,
          };
      }

      // Check if this is actually a failure
      if (
        req.body.workflow_run?.conclusion === 'success' ||
        req.body.build?.result === 'SUCCESS'
      ) {
        logger.debug('Webhook for successful run, ignoring');
        return res.status(200).json({ message: 'Pipeline succeeded' });
      }

      // Create failure record
      const failure = new PipelineFailure({
        ...failureData,
        status: 'pending-analysis',
      });

      const saved = await failure.save();
      logger.info({ failureId: saved._id }, 'Webhook failure recorded');

      // Queue for analysis
      const queues = await getQueues();
      const job = await queues.analysisQueue.add(
        'analyze-failure',
        {
          failureId: saved._id,
        },
        {
          jobId: uuidv4(),
          priority: 10,
        }
      );

      return res.status(202).json({
        success: true,
        failureId: saved._id.toString(),
        jobId: job.id,
        message: 'Webhook received and queued for analysis',
      });
    } catch (error) {
      logger.error({ err: error }, 'Webhook processing error');
      return res.status(500).json({
        error: 'Failed to process webhook',
        details: error.message,
      });
    }
  }

  /**
   * Get analysis result
   */
  static async getAnalysis(req, res) {
    try {
      const { analysisId } = req.params;

      const analysis = await AnalysisResult.findById(analysisId).populate(
        'failureId'
      );

      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      return res.json({
        success: true,
        analysis,
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching analysis');
      return res.status(500).json({
        error: 'Failed to fetch analysis',
        details: error.message,
      });
    }
  }

  /**
   * Get failure details
   */
  static async getFailure(req, res) {
    try {
      const { failureId } = req.params;

      const failure = await PipelineFailure.findById(failureId);

      if (!failure) {
        return res.status(404).json({ error: 'Failure not found' });
      }

      // Get associated analysis
      const analysis = await AnalysisResult.findOne({
        failureId,
      });

      // Get applied fixes
      const appliedFixes = await AppliedFix.find({ failureId });

      return res.json({
        success: true,
        failure,
        analysis,
        appliedFixes,
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching failure');
      return res.status(500).json({
        error: 'Failed to fetch failure',
        details: error.message,
      });
    }
  }

  /**
   * List recent failures
   */
  static async listFailures(req, res) {
    try {
      const { limit = 20, offset = 0, status, provider } = req.query;

      const query = {};
      if (status) query.status = status;
      if (provider) query.cicdProvider = provider;

      const failures = await PipelineFailure.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset));

      const total = await PipelineFailure.countDocuments(query);

      return res.json({
        success: true,
        failures,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error listing failures');
      return res.status(500).json({
        error: 'Failed to list failures',
        details: error.message,
      });
    }
  }

  /**
   * Apply a suggested fix
   */
  static async applyFix(req, res) {
    try {
      const { analysisId, fixId, appliedByUser } = req.body;

      // Validate input
      if (!analysisId || !fixId) {
        return res.status(400).json({
          error: 'Missing required fields: analysisId, fixId',
        });
      }

      const analysis = await AnalysisResult.findById(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      const fix = analysis.suggestedFixes.find((f) => f.id === fixId);
      if (!fix) {
        return res.status(404).json({ error: 'Fix not found' });
      }

      // Queue the fix
      const queues = await getQueues();
      const job = await queues.fixQueue.add(
        'apply-fix',
        {
          analysisResultId: analysisId,
          failureId: analysis.failureId,
          fix,
          appliedByUser: appliedByUser || 'api-user',
        },
        {
          jobId: uuidv4(),
        }
      );

      logger.info({ jobId: job.id, fixId }, 'Fix job queued');

      return res.status(202).json({
        success: true,
        jobId: job.id,
        message: 'Fix application queued',
        status: 'queued',
      });
    } catch (error) {
      logger.error({ err: error }, 'Error applying fix');
      return res.status(500).json({
        error: 'Failed to apply fix',
        details: error.message,
      });
    }
  }

  /**
   * Get all applied fixes for a failure
   */
  static async getAppliedFixes(req, res) {
    try {
      const { failureId } = req.params;

      const appliedFixes = await AppliedFix.find({ failureId }).sort({
        createdAt: -1,
      });

      return res.json({
        success: true,
        fixes: appliedFixes,
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching applied fixes');
      return res.status(500).json({
        error: 'Failed to fetch applied fixes',
        details: error.message,
      });
    }
  }

  /**
   * Get health status
   */
  static async getHealth(req, res) {
    return res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }

  /**
   * Get statistics
   */
  static async getStats(req, res) {
    try {
      const totalFailures = await PipelineFailure.countDocuments();
      const analyzedFailures = await PipelineFailure.countDocuments({
        status: 'analyzed',
      });
      const appliedFixes = await AppliedFix.countDocuments({
        status: 'success',
      });
      const failedFixes = await AppliedFix.countDocuments({
        status: 'failed',
      });

      return res.json({
        success: true,
        stats: {
          totalFailures,
          analyzedFailures,
          analysisRate: (analyzedFailures / totalFailures * 100).toFixed(2) + '%',
          successfulFixes: appliedFixes,
          failedFixes,
          successRate: (appliedFixes / (appliedFixes + failedFixes) * 100 || 0).toFixed(2) + '%',
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching stats');
      return res.status(500).json({
        error: 'Failed to fetch stats',
        details: error.message,
      });
    }
  }
}

export default AnalyzeController;
