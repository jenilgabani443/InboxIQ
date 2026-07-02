'use strict';

const morgan = require('morgan');
const logger = require('../utils/logger');

/**
 * HTTP request logger middleware.
 * Uses Morgan with a custom stream to pipe into Winston.
 * Skips health check endpoints to avoid log noise.
 *
 * In production: structured JSON format.
 * In development: colored 'dev' format for readability.
 */
const stream = {
  write: (message) => logger.http(message.trim()),
};

const skip = (req) => {
  // Skip health endpoints
  return req.path === '/health' || req.path === '/health/ready';
};

const requestLogger = morgan(
  process.env.NODE_ENV === 'production'
    ? ':remote-addr :method :url :status :res[content-length] - :response-time ms'
    : 'dev',
  { stream, skip },
);

module.exports = requestLogger;
