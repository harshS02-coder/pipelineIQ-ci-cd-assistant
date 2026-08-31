import 'dotenv/config';
import Redis from 'ioredis';
import logger from './logger.js';

const redisUrl = process.env.REDIS_URL;

/**
 * Creates a fresh ioredis instance compatible with BullMQ and standalone usage.
 */
export function createRedisClient() {
  if (redisUrl) {
    return new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });
  }

  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => Math.min(times * 100, 3000),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export const redis = createRedisClient();

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (error) => {
  logger.error({ err: error.message, code: error.code }, 'Redis connection error (verify REDIS_URL/REDIS_HOST)');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

export const disconnectRedis = async () => {
  try {
    await redis.quit();
    logger.info('Redis disconnected');
  } catch (error) {
    logger.error({ err: error }, 'Redis disconnection failed');
  }
};

export default redis;
