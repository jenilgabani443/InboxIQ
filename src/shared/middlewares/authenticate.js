'use strict';

const { verifyAccessToken } = require('../utils/tokenUtils');
const { getRedisClient } = require('../../config/redis');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

/**
 * JWT Authentication Middleware.
 *
 * Validates the Bearer token in the Authorization header.
 * Checks the Redis blacklist to reject logged-out tokens.
 * Attaches decoded user payload to req.user.
 *
 * @throws {ApiError.unauthorized} if token is missing, invalid, expired, or blacklisted
 */
const authenticate = asyncHandler(async (req, _res, next) => {
  console.log("========== AUTH ==========");
  console.log(req.headers);

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Authorization token is required");
  }

  const token = authHeader.split(" ")[1];

  const decoded = verifyAccessToken(token);

  const redis = getRedisClient();
  const isBlacklisted = await redis.get(`blacklist:${token}`);

  if (isBlacklisted) {
    throw ApiError.unauthorized("Token has been invalidated");
  }

  req.user = decoded;

  next();
});
// const authenticate = asyncHandler(async (req, _res, next) => {
//   // 1. Extract token from Authorization header
//   const authHeader = req.headers.authorization;
//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     throw ApiError.unauthorized('Authorization token is required');
//   }

//   const token = authHeader.split(' ')[1];

//   // 2. Verify token signature and expiry
//   const decoded = verifyAccessToken(token);

//   // 3. Check Redis blacklist (handles logout and rotation invalidation)
//   const redis = getRedisClient();
//   const isBlacklisted = await redis.get(`blacklist:${token}`);
//   if (isBlacklisted) {
//     logger.warn('Blacklisted token used:', { userId: decoded.id });
//     throw ApiError.unauthorized('Token has been invalidated. Please login again.');
//   }

//   // 4. Attach user payload to request
//   req.user = decoded;
//   next();
// });

module.exports = authenticate;
