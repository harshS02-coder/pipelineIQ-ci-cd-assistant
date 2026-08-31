import { Queue, Worker } from 'bullmq';
import { redisConfig } from '../config/redis.js';
import logger from '../config/logger.js';
import LogParser from '../services/logParser.js';
import llmService from '../services/llmService.js';
import fixService from '../services/fixService.js';
import PipelineFailure from '../models/PipelineFailure.js';
import AnalysisResult from '../models/AnalysisResult.js';

/**
 * Initialize BullMQ queues
 */
export const createQueues = () => {
  const analysisQueue = new Queue('pipeline-analysis', {
    connection: redisConfig,
    defaultJobOptions: {
      attempts: parseInt(process.env.QUEUE_MAX_ATTEMPTS || '3'),
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 1 day
      },
    },
  });

  const fixQueue = new Queue('auto-fix', {
    connection: redisConfig,
    defaultJobOptions: {
      attempts: parseInt(process.env.QUEUE_MAX_ATTEMPTS || '3'),
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 7200, // Keep completed jobs for 2 hours
      },
    },
  });

  const notificationQueue = new Queue('notifications', {
    connection: redisConfig,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  });

  // Setup event listeners
  setupQueueEventListeners(analysisQueue, fixQueue, notificationQueue);

  return {
    analysisQueue,
    fixQueue,
    notificationQueue,
  };
};

/**
 * Setup queue event listeners for monitoring
 */
const setupQueueEventListeners = (analysisQueue, fixQueue, notificationQueue) => {
  // Analysis Queue Events
  analysisQueue.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Analysis job completed');
  });

  analysisQueue.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, err: error },
      'Analysis job failed'
    );
  });

  analysisQueue.on('progress', (job, progress) => {
    logger.debug({ jobId: job.id, progress }, 'Analysis job progress');
  });

  // Fix Queue Events
  fixQueue.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Fix job completed');
  });

  fixQueue.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, err: error }, 'Fix job failed');
  });

  // Notification Queue Events
  notificationQueue.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Notification sent');
  });

  notificationQueue.on('failed', (job, error) => {
    logger.warn({ jobId: job?.id, err: error }, 'Notification job failed');
  });
};

/**
 * Create and register workers
 */
export const createWorkers = () => {
  // Analysis Worker
  const analysisWorker = new Worker(
    'pipeline-analysis',
    async (job) => {
      logger.info({ jobId: job.id }, 'Starting analysis job');

      const { failureId, context } = job.data;

      try {
        // Fetch failure from DB
        const failure = await PipelineFailure.findById(failureId);
        if (!failure) {
          throw new Error('Pipeline failure not found');
        }

        // Update status
        failure.status = 'analyzing';
        await failure.save();

        // Parse logs
        const keyInfo = LogParser.extractKeyInfo(
          failure.logs?.raw || failure.webhookPayload,
          failure.cicdProvider
        );

        // Call LLM service
        const llmResult = await llmService.analyzeFailure(
          keyInfo.summary,
          {
            repositoryUrl: failure.repositoryUrl,
            branch: failure.branch,
            commitSha: failure.commitSha,
            provider: failure.cicdProvider,
          }
        );

        if (!llmResult.success) {
          throw new Error(llmResult.error);
        }

        // Store analysis result
        const analysisResult = new AnalysisResult({
          failureId,
          requestId: job.id,
          summary: llmResult.analysis.summary,
          rootCause: llmResult.analysis.rootCause,
          rootCauseConfidence: llmResult.analysis.confidence,
          suggestedFixes: llmResult.analysis.suggestedFixes,
          analysisDetails: {
            llmModel: llmResult.metadata.model,
            llmProvider: llmResult.metadata.provider,
            analysisTime: llmResult.metadata.analysisTime,
            tokensUsed: llmResult.metadata.tokensUsed,
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
          },
          relatedIssues: llmResult.analysis.relatedIssues,
          relatedDocumentation: llmResult.analysis.relatedDocumentation,
          confidence: llmResult.analysis.confidence,
          status: 'completed',
          completedAt: new Date(),
        });

        await analysisResult.save();

        // Update failure status
        failure.status = 'analyzed';
        await failure.save();

        // Auto-attempt safe fixes if enabled
        if (
          process.env.ENABLE_AUTO_FIX === 'true' &&
          llmResult.analysis.suggestedFixes.length > 0
        ) {
          const safeFix = llmResult.analysis.suggestedFixes.find(
            (f) => f.isSafe === true
          );

          if (safeFix) {
            // Queue the fix job
            const fixQueue = (await getQueues()).fixQueue;
            await fixQueue.add('apply-fix', {
              analysisResultId: analysisResult._id,
              failureId,
              fix: safeFix,
              appliedByUser: 'system',
            });
          }
        }

        return {
          success: true,
          analysisId: analysisResult._id,
          summary: llmResult.analysis.summary,
        };
      } catch (error) {
        logger.error({ err: error, jobId: job.id }, 'Analysis failed');

        // Update failure status
        const failure = await PipelineFailure.findById(failureId);
        if (failure) {
          failure.status = 'failed';
          await failure.save();
        }

        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency: parseInt(process.env.QUEUE_MAX_WORKERS || '5'),
    }
  );

  // Fix Worker
  const fixWorker = new Worker(
    'auto-fix',
    async (job) => {
      logger.info({ jobId: job.id }, 'Starting fix job');

      const { analysisResultId, failureId, fix, appliedByUser } = job.data;

      try {
        const result = await fixService.applyFix(
          fix,
          analysisResultId,
          failureId,
          appliedByUser
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        return {
          success: true,
          appliedFixId: result.appliedFix._id,
        };
      } catch (error) {
        logger.error({ err: error, jobId: job.id }, 'Fix application failed');
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency: 2, // Run fixes serially for safety
    }
  );

  // Notification Worker
  const notificationWorker = new Worker(
    'notifications',
    async (job) => {
      logger.debug({ jobId: job.id }, 'Processing notification');

      const { type, payload } = job.data;

      // TODO: Implement actual notifications (Slack, email, webhooks, etc.)
      logger.info({ type, payload }, 'Notification would be sent');

      return { notified: true };
    },
    {
      connection: redisConfig,
      concurrency: 5,
    }
  );

  return {
    analysisWorker,
    fixWorker,
    notificationWorker,
  };
};

let queuesInstance = null;

/**
 * Get or create queue instances (singleton)
 */
export const getQueues = async () => {
  if (!queuesInstance) {
    queuesInstance = createQueues();
  }
  return queuesInstance;
};

/**
 * Close all workers and queues
 */
export const closeQueues = async () => {
  if (queuesInstance) {
    await queuesInstance.analysisQueue.close();
    await queuesInstance.fixQueue.close();
    await queuesInstance.notificationQueue.close();
  }
};
