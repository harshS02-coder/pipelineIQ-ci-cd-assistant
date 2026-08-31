import 'dotenv/config';
import mongoose from 'mongoose';
import logger from './logger.js';

export const connectDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/llm-devops-assistant';
    
    const connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority',
    });

    logger.info('MongoDB connected successfully');
    return connection;
  } catch (error) {
    logger.error({ err: error }, 'MongoDB connection failed');
    process.exit(1);
  }
};

export const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error({ err: error }, 'MongoDB disconnection failed');
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  logger.info('MongoDB connected to the database');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected to the database');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected from the database');
});

mongoose.connection.on('error', (error) => {
  logger.error({ err: error }, 'MongoDB error');
});
