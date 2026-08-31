import 'dotenv/config';

import logger from './config/logger.js';
import { connectDatabase } from './config/database.js';
import { createQueues, createWorkers } from './queues/index.js';
import { app, PORT } from './app.js';

// Validate required env vars
const requiredEnvVars = ['MONGODB_URI', 'REDIS_HOST'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.warn(`Environment variable ${envVar} is not set, using default`);
  }
}

/**
 * Start Server
 */
const startServer = async () => {
  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await connectDatabase();
    logger.info('MongoDB connected');

    // Setup queues
    logger.info('Setting up queues...');
    await createQueues();
    const workers = createWorkers();
    logger.info('Queues and workers initialized');

    // Start Express server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(
        { port: PORT, nodeEnv: process.env.NODE_ENV || 'development' },
        'Server started'
      );
    });

    // Handle server errors
    server.on('error', (error) => {
      logger.error({ err: error }, 'Server error');
      process.exit(1);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info({ signal }, 'Shutdown signal received');

      try {
        server.close(() => {
          logger.info('Server closed');
        });

        // Close workers
        if (workers) {
          await workers.analysisWorker.close();
          await workers.fixWorker.close();
          await workers.notificationWorker.close();
          logger.info('Workers closed');
        }

        process.exit(0);
      } catch (error) {
        logger.error({ err: error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();
