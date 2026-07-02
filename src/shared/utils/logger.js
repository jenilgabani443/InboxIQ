'use strict';

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const env = require('../../config/env');

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

// ── Development console format ────────────────────────────────────────────────
const devFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
  return `${ts} [${level}]: ${stack || message}${metaStr}`;
});

// ── Transports ────────────────────────────────────────────────────────────────
const transports = [];

if (env.NODE_ENV !== 'test') {
  // Console: colorized in dev, JSON in production
  transports.push(
    new winston.transports.Console({
      format:
        env.NODE_ENV === 'development'
          ? combine(colorize(), timestamp({ format: 'HH:mm:ss' }), errors({ stack: true }), devFormat)
          : combine(timestamp(), errors({ stack: true }), json()),
    }),
  );
}

if (env.NODE_ENV === 'production') {
  // Rotating file: error logs
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      zippedArchive: true,
      format: combine(timestamp(), errors({ stack: true }), json()),
    }),
  );

  // Rotating file: combined logs
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      zippedArchive: true,
      format: combine(timestamp(), errors({ stack: true }), json()),
    }),
  );
}

// ── Logger Instance ───────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { service: env.APP_NAME },
  transports,
  exitOnError: false,
});

module.exports = logger;
