import 'dotenv/config';
import Redis from 'ioredis';
import logger from './logger.js';

const redisUrl = process.env.REDIS_URL;

export const redisConfig = redisUrl
  ? {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    }
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

export const redis = redisUrl
  ? new Redis(redisUrl, redisConfig)
  : new Redis(redisConfig);

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (error) => {
  logger.error({ err: error }, 'Redis error');
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
