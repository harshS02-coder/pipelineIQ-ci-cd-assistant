/**
 * Utility Helper Functions
 */

import crypto from 'crypto';
import logger from '../config/logger.js';

/**
 * Generate a unique request ID
 */
export const generateRequestId = () => {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
};

/**
 * Sanitize logs for safe processing
 */
export const sanitizeLogs = (logs) => {
  let sanitized = logs;

  // Remove sensitive patterns
  const patterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /(password|passwd|pwd|secret|token|api[_-]?key)=["']?[^"'\s]+["']?/gi, // Credentials
    /(Bearer|Basic|AWS4-HMAC-SHA256)[^"\s]+/g, // Auth tokens
    /\b\d{4}-\d{4}-\d{4}-\d{4}\b/g, // Credit cards
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  ];

  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
};

/**
 * Truncate text with ellipsis
 */
export const truncate = (text, maxLength = 100) => {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Format bytes to human readable
 */
export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Format duration in human readable format
 */
export const formatDuration = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

/**
 * Parse X-GitHub-Delivery header to validate uniqueness
 */
export const getGitHubDeliveryId = (headers) => {
  return headers['x-github-delivery'] || null;
};

/**
 * Retry mechanism for API calls
 */
export const retry = async (fn, maxAttempts = 3, delayMs = 1000) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      logger.warn(
        { attempt, maxAttempts, error: error.message },
        'Retry attempt'
      );

      if (attempt < maxAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * Math.pow(2, attempt - 1))
        );
      }
    }
  }

  throw lastError;
};

/**
 * Validate MongoDB ObjectId
 */
export const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Extract first N error lines from logs
 */
export const extractErrors = (logs, count = 10) => {
  const lines = logs.split('\n');
  const errors = lines
    .filter((line) => line.match(/error|failed|failure|fatal/i))
    .slice(0, count);

  return errors.join('\n');
};

/**
 * Create a hash for deduplication
 */
export const hashContent = (content) => {
  return crypto.createHash('sha256').update(content).digest('hex');
};

/**
 * Sleep for specified milliseconds
 */
export const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export default {
  generateRequestId,
  sanitizeLogs,
  truncate,
  formatBytes,
  formatDuration,
  getGitHubDeliveryId,
  retry,
  isValidObjectId,
  extractErrors,
  hashContent,
  sleep,
};
