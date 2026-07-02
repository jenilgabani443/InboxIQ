'use strict';

const HTTP_STATUS = require('../constants/httpStatus');

/**
 * Standardized API response envelope.
 *
 * All API responses follow this shape:
 * {
 *   success: boolean,
 *   message: string,
 *   data: object | null,
 *   meta: object | null,       // pagination, counts, etc.
 *   errors: array | null,      // field-level validation errors
 *   timestamp: ISO string
 * }
 *
 * This consistency allows frontend clients and API consumers
 * to handle responses uniformly without per-endpoint parsing logic.
 */
class ApiResponse {
  /**
   * @param {import('express').Response} res
   * @param {number} statusCode
   * @param {string} message
   * @param {*} [data=null]
   * @param {object} [meta=null]
   */
  static send(res, statusCode, message, data = null, meta = null) {
    return res.status(statusCode).json({
      success: statusCode < 400,
      message,
      data,
      meta,
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }

  static ok(res, message, data = null, meta = null) {
    return ApiResponse.send(res, HTTP_STATUS.OK, message, data, meta);
  }

  static created(res, message, data = null) {
    return ApiResponse.send(res, HTTP_STATUS.CREATED, message, data);
  }

  static noContent(res) {
    return res.status(HTTP_STATUS.NO_CONTENT).end();
  }

  static error(res, statusCode, message, errors = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      data: null,
      meta: null,
      errors,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = ApiResponse;
