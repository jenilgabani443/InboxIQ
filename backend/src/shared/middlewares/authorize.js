'use strict';

const ApiError = require('../utils/apiError');

/**
 * Role-Based Access Control middleware factory.
 *
 * Usage:
 *   router.delete('/users/:id', authenticate, authorize('admin'), controller.deleteUser);
 *
 * @param {...string} allowedRoles - One or more roles that may access this route
 * @returns {Function} Express middleware
 */
const authorize =
  (...allowedRoles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        ),
      );
    }

    return next();
  };

module.exports = authorize;
