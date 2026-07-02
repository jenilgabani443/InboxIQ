'use strict';

const ApiError = require('../utils/apiError');

/**
 * Zod Request Validation Middleware Factory.
 *
 * Validates req.body, req.query, and req.params against a provided Zod schema.
 * On success, replaces the request properties with parsed (type-coerced) values.
 * On failure, throws ApiError.unprocessable with field-level error details.
 *
 * Usage:
 *   const { loginSchema } = require('./auth.validator');
 *   router.post('/login', validate(loginSchema), authController.login);
 *
 * @param {import('zod').ZodObject} schema - Zod schema with optional body/query/params keys
 * @returns {Function} Express middleware
 */
const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    const errors = result.error.errors.map((err) => ({
      field: err.path.filter((p) => p !== 'body' && p !== 'query' && p !== 'params').join('.'),
      message: err.message,
      code: err.code,
    }));

    return next(ApiError.unprocessable('Validation failed', errors));
  }

  // Replace request properties with Zod-parsed (and coerced) values
  if (result.data.body) req.body = result.data.body;
  if (result.data.query) req.query = result.data.query;
  if (result.data.params) req.params = result.data.params;

  return next();
};

module.exports = validate;
