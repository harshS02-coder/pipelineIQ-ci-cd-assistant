import { redis } from '../config/redis.js';
import logger from '../config/logger.js';

/**
 * Rate Limiting Middleware
 * Uses Redis to track requests per IP/API key
 */
export const rateLimit = async (req, res, next) => {
  try {
    const windowMs = parseInt(
      process.env.RATE_LIMIT_WINDOW_MS || '900000'
    );
    const maxRequests = parseInt(
      process.env.RATE_LIMIT_MAX_REQUESTS || '100'
    );

    // Use API key if present, otherwise use IP
    const identifier =
      req.headers['x-api-key'] || req.ip || 'unknown';
    const key = `rate-limit:${identifier}`;

    const current = await redis.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= maxRequests) {
      logger.warn({ identifier, count }, 'Rate limit exceeded');
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    }

    // Increment counter
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    if (count === 0) {
      pipeline.expire(key, Math.ceil(windowMs / 1000));
    }
    await pipeline.exec();

    // Set headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - count - 1);
    res.setHeader('X-RateLimit-Reset', Date.now() + windowMs);

    next();
  } catch (error) {
    logger.error({ err: error }, 'Rate limiting error');
    // On error, allow request but log it
    next();
  }
};

/**
 * Request ID middleware
 * Adds a unique ID to each request for tracking
 */
export const requestId = (req, res, next) => {
  const id =
    req.headers['x-request-id'] ||
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
};
