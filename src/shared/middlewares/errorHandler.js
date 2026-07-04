'use strict';

const mongoose = require('mongoose');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');
const env = require('../../config/env');

/**
 * Global Express error handler.
 *
 * Must be registered LAST, after all routes and other middleware.
 * Normalizes all error types (ApiError, Mongoose, JWT, Zod, generic)
 * into a consistent API response envelope.
 *
 * Error classification:
 * - ApiError (isOperational: true)  → Return structured error response
 * - ApiError (isOperational: false) → Log as critical, return 500
 * - Mongoose ValidationError        → Map to 422 with field details
 * - Mongoose CastError              → Map to 400 (invalid ObjectId etc.)
 * - Mongoose duplicate key (11000)  → Map to 409 Conflict
 * - JsonWebTokenError               → Map to 401
 * - Unknown errors                  → Return generic 500
 */
 
const errorHandler = (err, req, res, _next) => {
  let error = err;

  // ── Normalize Mongoose ValidationError ────────────────────────────────────
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = ApiError.unprocessable('Validation failed', errors);
  }

  // ── Normalize Mongoose CastError (bad ObjectId) ───────────────────────────
  if (err instanceof mongoose.Error.CastError) {
    error = ApiError.badRequest(`Invalid value for field: ${err.path}`);
  }

  // ── Normalize MongoDB Duplicate Key ───────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = ApiError.conflict(`${field} already exists`);
  }

  // ── Normalize JWT Errors ──────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Token expired');
  }

  // ── Determine if it's a known operational error ───────────────────────────
  const isOperational = error instanceof ApiError && error.isOperational;
  const statusCode = error.statusCode || 500;
  const message = isOperational ? error.message : 'An unexpected error occurred';

  // ── Log error ─────────────────────────────────────────────────────────────
  const logContext = {
    method: req.method,
    path: req.path,
    statusCode,
    userId: req.user?.id,
    errorName: err.name,
  };

  if (statusCode >= 500) {
    logger.error(err.message, { ...logContext, stack: err.stack });
  } else if (statusCode >= 400) {
    logger.warn(err.message, logContext);
  }

  // ── Send response ─────────────────────────────────────────────────────────
  return ApiResponse.error(res, statusCode, message, error.errors || null);
};

module.exports = errorHandler;
