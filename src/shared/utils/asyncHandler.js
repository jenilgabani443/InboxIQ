'use strict';

/**
 * Async handler wrapper for Express route controllers.
 *
 * Eliminates repetitive try/catch blocks in every controller.
 * Catches any thrown error (including ApiError subclasses) and
 * forwards it to Express's next(err) error handler.
 *
 * Usage:
 *   router.get('/resource', asyncHandler(controller.getResource));
 *
 * @param {Function} fn - Async express route handler
 * @returns {Function} Express middleware with error forwarding
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
