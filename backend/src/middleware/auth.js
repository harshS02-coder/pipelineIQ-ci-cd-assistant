import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

/**
 * Authentication Middleware
 * Validates API key and JWT tokens
 *
 * AUTHENTICATION FLOW:
 * 1. First checks for an API key in the X-API-Key header (existing auth)
 * 2. Then checks for a JWT Bearer token in the Authorization header
 *    (new: issued after GitHub OAuth login)
 * 3. If neither is present, returns 401 Unauthorized
 */
export const authenticateRequest = (req, res, next) => {
  try {
    // Skip auth for public endpoints
    if (req.path === '/health') {
      return next();
    }

    // Check for API Key (existing auth mechanism)
    const apiKeyHeader = process.env.API_KEY_HEADER || 'X-API-Key';
    const providedKey = req.headers[apiKeyHeader.toLowerCase()];
    const expectedKey = process.env.API_KEY;

    if (providedKey && providedKey === expectedKey) {
      req.user = { type: 'api-key', authenticated: true };
      return next();
    }

    // Check for Bearer Token (JWT issued after GitHub OAuth)
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/);

    if (match && match[1]) {
      // Verify the JWT signature and extract the payload
      // jwt.verify() throws if the token is invalid, expired, or tampered with
      const decoded = jwt.verify(match[1], process.env.JWT_SECRET);

      // Attach user info to the request for use in controllers
      req.user = {
        type: 'bearer',
        authenticated: true,
        userId: decoded.userId,
        githubId: decoded.githubId,
        githubUsername: decoded.githubUsername,
      };
      return next();
    }

    // Log unauthorized attempt
    logger.warn(
      { 
        path: req.path, 
        method: req.method,
        ip: req.ip 
      },
      'Unauthorized request'
    );

    return res.status(401).json({
      error: 'Unauthorized',
      message: `Missing or invalid ${apiKeyHeader} header`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Authentication error');
    return res.status(500).json({
      error: 'Authentication failed',
    });
  }
};

/**
 * Optional Authentication Middleware
 * Authenticates if credentials are provided, continues if not
 */
export const optionalAuth = (req, res, next) => {
  const apiKeyHeader = process.env.API_KEY_HEADER || 'X-API-Key';
  const providedKey = req.headers[apiKeyHeader.toLowerCase()];
  const expectedKey = process.env.API_KEY;

  if (providedKey && providedKey === expectedKey) {
    req.user = { type: 'api-key', authenticated: true };
  }

  next();
};
