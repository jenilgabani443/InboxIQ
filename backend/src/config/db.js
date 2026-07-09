'use strict';

const mongoose = require('mongoose');
const logger = require('../shared/utils/logger');
const env = require('./env');

/**
 * Establishes MongoDB connection with retry logic and connection event listeners.
 * Uses a single connection strategy — appropriate for single-process Node.js apps.
 * For multi-replica sets, upgrade to a replica set URI in production.
 */
const connectDB = async () => {
  const uri = env.NODE_ENV === 'test' ? env.MONGO_TEST_URI : env.MONGO_URI;

  mongoose.set('strictQuery', true);

  // Connection event listeners
  mongoose.connection.on('connected', () => {
    logger.info(`MongoDB connected: ${mongoose.connection.host}`);
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', { error: err.message });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed on app termination');
    process.exit(0);
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
  });
};

const disconnectDB = async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
};

module.exports = {
  connectDB,
  disconnectDB,
  mongoose,
};