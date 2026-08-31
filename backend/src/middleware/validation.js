import logger from '../config/logger.js';

/**
 * Request Validation Middleware
 */
export const validateRequest = (schema) => {
  return (req, res, next) => {
    const errors = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      if (rules.required && (value === undefined || value === null)) {
        errors[field] = `Field is required`;
        continue;
      }

      if (value !== undefined && value !== null) {
        if (rules.type && typeof value !== rules.type) {
          errors[field] = `Field must be of type ${rules.type}`;
        }

        if (rules.minLength && value.length < rules.minLength) {
          errors[field] = `Field must be at least ${rules.minLength} characters`;
        }

        if (rules.maxLength && value.length > rules.maxLength) {
          errors[field] = `Field must be at most ${rules.maxLength} characters`;
        }

        if (rules.pattern && !rules.pattern.test(value)) {
          errors[field] = `Field format is invalid`;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      logger.warn({ errors }, 'Validation failed');
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }

    next();
  };
};

/**
 * Validate Analysis ID format
 */
export const validateAnalysisId = (req, res, next) => {
  const { analysisId } = req.params;

  // MongoDB ObjectId validation
  if (!/^[0-9a-fA-F]{24}$/.test(analysisId)) {
    return res.status(400).json({
      error: 'Invalid analysis ID format',
    });
  }

  next();
};

/**
 * Validate Pipeline ID format
 */
export const validatePipelineId = (req, res, next) => {
  const { failureId } = req.params;

  if (!/^[0-9a-fA-F]{24}$/.test(failureId)) {
    return res.status(400).json({
      error: 'Invalid failure ID format',
    });
  }

  next();
};
