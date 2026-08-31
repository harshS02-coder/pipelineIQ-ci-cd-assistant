import logger from '../config/logger.js';

/**
 * LogParser Service
 * Parses logs from different CI/CD systems and extracts meaningful information
 */
class LogParser {
  /**
   * Parse logs from various CI/CD providers
   * @param {string} logs - Raw log content
   * @param {string} provider - CI/CD provider (github-actions, jenkins, etc.)
   * @returns {object} Parsed log data
   */
  static parse(logs, provider = 'github-actions') {
    if (!logs || typeof logs !== 'string') {
      return {
        error: 'Invalid logs provided',
        parsed: null,
      };
    }

    try {
      switch (provider) {
        case 'github-actions':
          return this.parseGitHubActions(logs);
        case 'jenkins':
          return this.parseJenkins(logs);
        case 'gitlab-ci':
          return this.parseGitLabCI(logs);
        default:
          return this.parseGeneric(logs);
      }
    } catch (error) {
      logger.error({ err: error, provider }, 'Error parsing logs');
      return {
        error: error.message,
        parsed: null,
      };
    }
  }

  static parseGitHubActions(logs) {
    const lines = logs.split('\n');
    const parsed = {
      errors: [],
      warnings: [],
      stages: {},
      duration: null,
      failurePoint: null,
      lastError: null,
      errorContext: {
        before: [],
        error: null,
        after: [],
      },
    };

    let currentStage = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect stage start
      if (line.includes('##[group]') || line.match(/^Run /)) {
        currentStage = line.replace('##[group]', '').trim();
        parsed.stages[currentStage] = [];
      }

      // Detect errors
      if (
        line.includes('##[error]') ||
        line.includes('Error:') ||
        line.includes('ERROR')
      ) {
        parsed.errors.push({
          line: i + 1,
          message: line.trim(),
          stage: currentStage,
        });
        parsed.lastError = line.trim();
        parsed.failurePoint = currentStage;

        // Capture context
        parsed.errorContext.before = lines
          .slice(Math.max(0, i - 3), i)
          .map((l) => l.trim());
        parsed.errorContext.error = line.trim();
        parsed.errorContext.after = lines
          .slice(i + 1, Math.min(lines.length, i + 4))
          .map((l) => l.trim());
      }

      // Detect warnings
      if (line.includes('##[warning]') || line.includes('Warning:')) {
        parsed.warnings.push({
          line: i + 1,
          message: line.trim(),
          stage: currentStage,
        });
      }

      if (currentStage) {
        parsed.stages[currentStage].push(line);
      }
    }

    return {
      parsed,
      provider: 'github-actions',
    };
  }

  static parseJenkins(logs) {
    const lines = logs.split('\n');
    const parsed = {
      errors: [],
      warnings: [],
      stages: {},
      failurePoint: null,
      lastError: null,
      errorContext: {
        before: [],
        error: null,
        after: [],
      },
    };

    let currentStage = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect stage
      if (line.match(/^\[.*\]\s+Stage:/i)) {
        currentStage = line.match(/Stage:\s*(.*)/)[1];
        parsed.stages[currentStage] = [];
      }

      if (line.includes('ERROR') || line.includes('Error:')) {
        parsed.errors.push({
          line: i + 1,
          message: line.trim(),
          stage: currentStage,
        });
        parsed.lastError = line.trim();
        parsed.failurePoint = currentStage;

        parsed.errorContext.before = lines
          .slice(Math.max(0, i - 3), i)
          .map((l) => l.trim());
        parsed.errorContext.error = line.trim();
        parsed.errorContext.after = lines
          .slice(i + 1, Math.min(lines.length, i + 4))
          .map((l) => l.trim());
      }

      if (currentStage) {
        parsed.stages[currentStage].push(line);
      }
    }

    return {
      parsed,
      provider: 'jenkins',
    };
  }

  static parseGitLabCI(logs) {
    const lines = logs.split('\n');
    const parsed = {
      errors: [],
      warnings: [],
      stages: {},
      failurePoint: null,
      lastError: null,
    };

    let currentStage = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.match(/^.*(section_start|section_end):/)) {
        const match = line.match(/:(.+?)\[/);
        if (match) currentStage = match[1];
      }

      if (line.includes('ERROR') || line.includes('fatal:')) {
        parsed.errors.push({
          line: i + 1,
          message: line.trim(),
          stage: currentStage,
        });
        parsed.lastError = line.trim();
        parsed.failurePoint = currentStage;
      }
    }

    return {
      parsed,
      provider: 'gitlab-ci',
    };
  }

  static parseGeneric(logs) {
    const lines = logs.split('\n');
    const parsed = {
      errors: [],
      warnings: [],
      failurePoint: null,
      lastError: null,
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.match(/error|failed|failure/i)) {
        parsed.errors.push({
          line: i + 1,
          message: line.trim(),
        });
        parsed.lastError = line.trim();
      }

      if (line.match(/warning|warn/i)) {
        parsed.warnings.push({
          line: i + 1,
          message: line.trim(),
        });
      }
    }

    return {
      parsed,
      provider: 'generic',
    };
  }

  /**
   * Truncate logs to reasonable size for LLM processing
   * @param {string} logs - Raw logs
   * @param {number} maxSize - Max size in characters
   * @returns {object} {content, truncated, originalSize}
   */
  static truncateLogs(logs, maxSize = 8000) {
    if (logs.length <= maxSize) {
      return {
        content: logs,
        truncated: false,
        originalSize: logs.length,
      };
    }

    const lines = logs.split('\n');
    let content = '';
    let truncated = false;

    // First, try to keep error lines
    const errorLines = lines
      .filter((line) => line.match(/error|failed|failure/i))
      .slice(0, 10);
    const lastLines = lines.slice(-20);

    const selected = [
      ...lines.slice(0, 10),
      ...errorLines,
      ...lastLines,
    ];

    content = Array.from(new Set(selected)).join('\n').substring(0, maxSize);

    return {
      content,
      truncated: true,
      originalSize: logs.length,
    };
  }

  /**
   * Extract key information for LLM analysis
   */
  static extractKeyInfo(logs, provider) {
    const parsed = this.parse(logs, provider);
    const truncated = this.truncateLogs(logs);

    return {
      originalSize: logs.length,
      truncatedSize: truncated.content.length,
      isTruncated: truncated.truncated,
      errorCount: parsed.parsed?.errors?.length || 0,
      warningCount: parsed.parsed?.warnings?.length || 0,
      lastError: parsed.parsed?.lastError,
      failurePoint: parsed.parsed?.failurePoint,
      errorContext: parsed.parsed?.errorContext,
      summary: truncated.content,
    };
  }
}

export default LogParser;
