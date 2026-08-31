import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import 'express-async-errors';
import logger from './config/logger.js';
import { requestId, rateLimit } from './middleware/rateLimit.js';
import analyzeRoutes from './routes/analyze.routes.js';
import githubRoutes from './routes/github.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import { createWorkers } from './queues/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname (needed for static file serving)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Middleware Setup
 */

// Security
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://*.githubusercontent.com", "https://github.com"],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Logging
app.use(pinoHttp({ logger }));

// Request tracking
app.use(requestId);

/**
 * Routes
 */
// Mount before the global parsers so the webhook route can retain raw bytes
// for HMAC verification, including legacy form-encoded deliveries.
app.use('/webhook', webhookRoutes);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/api/v1/analyze', analyzeRoutes);
app.use('/api/v1/github', githubRoutes);

// Serve frontend static files from the public/ directory (no cache in dev)
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    name: 'LLM-Powered DevOps Assistant',
    version: '1.0.0',
    description: 'CI/CD Failure Analysis and Safe Auto-Fix',
    status: 'running',
  });
});

/**
 * 404 Handler
 */
app.use((req, res) => {
  logger.warn({ path: req.path, method: req.method }, 'Route not found');
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    message: 'The requested resource was not found',
  });
});

/**
 * Global Error Handler
 */
app.use((error, req, res, next) => {
  logger.error({ err: error, path: req.path }, 'Unhandled error');

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    requestId: req.id,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Graceful Shutdown
 */
let workers = null;

const gracefulShutdown = async (signal) => {
  logger.info({ signal }, 'Graceful shutdown initiated');

  try {
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

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, PORT, createWorkers, gracefulShutdown };
