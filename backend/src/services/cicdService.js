import crypto from 'crypto';
import logger from '../config/logger.js';

/**
 * CI/CD Integration Service
 * Handles webhook validation and payload parsing from different CI/CD providers
 */
class CICDService {
  /**
   * Validate GitHub Actions webhook
   */
  static validateGitHubWebhook(payload, signature) {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      logger.warn('GitHub webhook secret not configured');
      return false;
    }

    const hash = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const expectedSignature = `sha256=${hash}`;
    const bufExpected = Buffer.from(expectedSignature);
    const bufActual = Buffer.from(signature || '');

    if (bufExpected.length !== bufActual.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufExpected, bufActual);
  }

  /**
   * Extract failure info from GitHub Actions webhook
   */
  static parseGitHubPayload(payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;

    return {
      pipelineId: data.workflow?.id?.toString() || 'unknown',
      pipelineName: data.workflow?.name || 'Unknown Workflow',
      cicdProvider: 'github-actions',
      commitSha: data.workflow_run?.head_commit?.id || 'unknown',
      commitAuthor: data.workflow_run?.head_commit?.author?.name,
      repositoryUrl: data.repository?.html_url,
      branch: data.workflow_run?.head_branch,
      logs: '', // Logs will be fetched via API
      failureType: this.inferFailureType(data),
      webhookPayload: data,
      status: 'pending-analysis',
    };
  }

  /**
   * Parse Jenkins webhook
   */
  static parseJenkinsPayload(payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;

    return {
      pipelineId: data.build?.number?.toString() || 'unknown',
      pipelineName: data.name || 'Unknown Job',
      cicdProvider: 'jenkins',
      commitSha: data.build?.scm?.commit || 'unknown',
      commitAuthor: data.build?.scm?.committer,
      repositoryUrl: data.build?.scm?.url,
      branch: data.build?.scm?.branch,
      logs: data.build?.log || '',
      failureType: this.inferJenkinsFailureType(data),
      webhookPayload: data,
      status: 'pending-analysis',
    };
  }

  /**
   * Parse GitLab CI webhook
   */
  static parseGitLabPayload(payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;

    return {
      pipelineId: data.object_attributes?.id?.toString() || 'unknown',
      pipelineName: data.project?.name || 'Unknown Project',
      cicdProvider: 'gitlab-ci',
      commitSha: data.object_attributes?.sha || 'unknown',
      commitAuthor: data.user?.name,
      repositoryUrl: data.project?.web_url,
      branch: data.object_attributes?.ref,
      logs: '', // Logs will be fetched via API
      failureType: this.inferGitLabFailureType(data),
      webhookPayload: data,
      status: 'pending-analysis',
    };
  }

  /**
   * Infer failure type from GitHub Actions
   */
  static inferFailureType(data) {
    const failureReason = data.workflow_run?.conclusion?.toLowerCase() || '';
    const jobName = data.workflow_run?.name?.toLowerCase() || '';

    if (jobName.includes('test') || failureReason.includes('test')) {
      return 'test';
    }
    if (jobName.includes('build') || jobName.includes('compile')) {
      return 'build';
    }
    if (
      jobName.includes('deploy') ||
      jobName.includes('release') ||
      failureReason.includes('deploy')
    ) {
      return 'deployment';
    }
    if (
      jobName.includes('security') ||
      jobName.includes('scan') ||
      jobName.includes('sast')
    ) {
      return 'security-scan';
    }
    if (jobName.includes('lint') || jobName.includes('format')) {
      return 'lint';
    }

    return 'unknown';
  }

  static inferJenkinsFailureType(data) {
    const jobName = data.name?.toLowerCase() || '';
    const result = data.build?.result?.toLowerCase() || '';

    if (jobName.includes('test')) {
      return 'test';
    }
    if (jobName.includes('build') || jobName.includes('compile')) {
      return 'build';
    }
    if (jobName.includes('deploy') || jobName.includes('release')) {
      return 'deployment';
    }

    return 'unknown';
  }

  static inferGitLabFailureType(data) {
    const pipelineName = data.object_attributes?.stages?.join('|') || '';

    if (pipelineName.includes('test')) {
      return 'test';
    }
    if (pipelineName.includes('build')) {
      return 'build';
    }
    if (pipelineName.includes('deploy')) {
      return 'deployment';
    }

    return 'unknown';
  }

  /**
   * Fetch logs from GitHub Actions via API
   */
  static async fetchGitHubLogs(owner, repo, runId) {
    try {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        logger.warn('GITHUB_TOKEN not configured');
        return null;
      }

      // This would require axios and proper GitHub API calls
      // For now, return placeholder
      logger.info({ owner, repo, runId }, 'GitHub logs fetch requested');
      return null;
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch GitHub logs');
      return null;
    }
  }

  /**
   * Determine CI/CD provider from headers or payload
   */
  static detectProvider(headers = {}, payload = null) {
    const lowerHeaders = Object.keys(headers).reduce((acc, key) => {
      acc[key.toLowerCase()] = headers[key];
      return acc;
    }, {});

    // GitHub Actions
    if (lowerHeaders['x-github-event']) {
      return 'github-actions';
    }

    // Jenkins
    if (lowerHeaders['x-jenkins'] || lowerHeaders['x-jenkins-version']) {
      return 'jenkins';
    }

    // GitLab
    if (lowerHeaders['x-gitlab-event']) {
      return 'gitlab-ci';
    }

    // CircleCI
    if (lowerHeaders['circleci-webhook-signature']) {
      return 'circleci';
    }

    // Fallback: try to detect from payload
    if (payload) {
      const data =
        typeof payload === 'string' ? JSON.parse(payload) : payload;

      if (data.workflow_run) return 'github-actions';
      if (data.build) return 'jenkins';
      if (data.project?.web_url) return 'gitlab-ci';
      if (data.vcs?.type) return 'circleci';
    }

    return 'unknown';
  }

  /**
   * Format failure notification
   */
  static formatNotification(failure, analysis = null) {
    const message = {
      title: `CI/CD Pipeline Failed: ${failure.pipelineName}`,
      description: failure.logs?.substring(0, 500) || 'Pipeline failed',
      metadata: {
        pipeline: failure.pipelineId,
        provider: failure.cicdProvider,
        commit: failure.commitSha?.substring(0, 8),
        branch: failure.branch,
        failureType: failure.failureType,
        timestamp: new Date().toISOString(),
      },
    };

    if (analysis) {
      message.analysis = {
        summary: analysis.summary,
        rootCause: analysis.rootCause,
        suggestedFixes: analysis.suggestedFixes?.length || 0,
      };
    }

    return message;
  }
}

export default CICDService;
