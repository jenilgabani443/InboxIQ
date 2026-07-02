'use strict';

const HTTP_STATUS = require('../constants/httpStatus');

/**
 * Custom application error class.
 *
 * Extends Error to carry HTTP status codes and structured metadata.
 * The global error handler checks isOperational to distinguish known
 * domain errors (send 4xx/5xx) from unexpected programmer errors (crash).
 *
 * Usage:
 *   throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Email not found');
 *   throw new ApiError(HTTP_STATUS.CONFLICT, 'Email already exists', true, [{ field: 'email' }]);
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Human-readable error message
   * @param {boolean} [isOperational=true] - If false, triggers crash (unexpected errors)
   * @param {Array} [errors=[]] - Field-level validation errors
   * @param {string} [stack=''] - Optional custom stack trace
   */
  constructor(statusCode, message, isOperational = true, errors = [], stack = '') {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // ── Static factory methods for common errors ──────────────────────────────

  static badRequest(message = 'Bad Request', errors = []) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message, true, errors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(HTTP_STATUS.NOT_FOUND, message);
  }

  static conflict(message = 'Conflict') {
    return new ApiError(HTTP_STATUS.CONFLICT, message);
  }

  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message, false);
  }

  static unprocessable(message = 'Unprocessable Entity', errors = []) {
    return new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, message, true, errors);
  }
}

module.exports = ApiError;
