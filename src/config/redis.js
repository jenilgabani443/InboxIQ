'use strict';

const Redis = require('ioredis');
const logger = require('../shared/utils/logger');
const env = require('./env');

/**
 * Redis client singleton.
 * Used for: JWT blacklisting, rate limiting, Bull queues, Socket.IO adapter, caching.
 *
 * lazyConnect: true — prevents connection on require; connect() is called explicitly
 * so the app can boot without Redis and fail fast with a clear error.
 */
let redisClient = null;

const getRedisClient = () => {
  if (redisClient) return redisClient;

  redisClient = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      logger.warn(`Redis retry attempt ${times}, retrying in ${delay}ms`);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
      if (targetErrors.some((e) => err.message.includes(e))) {
        return true;
      }
      return false;
    },
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client ready');
  });

  redisClient.on('error', (err) => {
    logger.error('Redis client error:', { error: err.message });
  });

  redisClient.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return redisClient;
};

const connectRedis = async () => {
  const client = getRedisClient();

  // Only connect if not already connected
  if (
    client.status !== 'connecting' &&
    client.status !== 'connect' &&
    client.status !== 'ready'
  ) {
    await client.connect();
  }

  return client;
};

const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected');
  }
};

module.exports = {
  getRedisClient,
  connectRedis,
  disconnectRedis,
};