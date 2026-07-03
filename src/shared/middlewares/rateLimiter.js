'use strict';

const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedisClient } = require('../../config/redis');
const env = require('../../config/env');
const ApiError = require('../utils/apiError');

/**
 * Creates a rate limiter middleware backed by Redis.
 * Using Redis ensures limits are enforced correctly across multiple server instances.
 *
 * @param {object} [options]
 * @param {number} [options.windowMs] - Time window in ms
 * @param {number} [options.max] - Max requests per window
 * @param {string} [options.message] - Custom error message
 * @returns {Function} Express rate limiter middleware
 */
const createRateLimiter = ({
  windowMs = env.RATE_LIMIT_WINDOW_MS,
  max = env.RATE_LIMIT_MAX,
  message = 'Too many requests, please try again later.',
} = {}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,   // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,     // Disable X-RateLimit-* headers
    ...(process.env.NODE_ENV !== 'test' && {
      store: new RedisStore({
        sendCommand: (...args) => getRedisClient().call(...args),
        prefix: 'rl:',
      }),
    }),
    handler: (_req, _res, next) => {
      next(ApiError.tooManyRequests(message));
    },
  });

// Pre-configured limiters for common use cases
const globalLimiter = createRateLimiter();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  message: 'Upload limit reached. Please try again in an hour.',
});

module.exports = { createRateLimiter, globalLimiter, authLimiter, uploadLimiter };
