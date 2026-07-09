'use strict';

const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const ApiError = require('./apiError');

/**
 * Generates a signed JWT access token.
 *
 * @param {object} payload - Data to embed in token
 * @returns {string} Signed JWT
 */
const generateAccessToken = (payload) => {
  console.log('JWT_ACCESS_EXPIRES_IN =', env.JWT_ACCESS_EXPIRES_IN);

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: env.APP_NAME,
    audience: 'inboxiq-client',
  });
};

/**
 * Generates a signed JWT refresh token.
 *
 * @param {object} payload - Data to embed in token
 * @returns {string} Signed JWT
 */
const generateRefreshToken = (payload) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: env.APP_NAME,
    audience: 'inboxiq-client',
  });

/**
 * Verifies an access token and returns its decoded payload.
 * Throws ApiError.unauthorized on invalid or expired tokens.
 *
 * @param {string} token
 * @returns {object} Decoded payload
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: env.APP_NAME,
      audience: 'inboxiq-client',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Access token expired');
    }
    throw ApiError.unauthorized('Invalid access token');
  }
};

/**
 * Verifies a refresh token and returns its decoded payload.
 * Throws ApiError.unauthorized on invalid or expired tokens.
 *
 * @param {string} token
 * @returns {object} Decoded payload
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: env.APP_NAME,
      audience: 'inboxiq-client',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Refresh token expired. Please login again.');
    }
    throw ApiError.unauthorized('Invalid refresh token');
  }
};

/**
 * Verifies a Socket.IO handshake token.
 * Wrapper around verifyAccessToken — separated for clarity.
 *
 * @param {string} token
 * @returns {object} Decoded payload
 */
const verifySocketToken = (token) => verifyAccessToken(token);

/**
 * Decodes a token without verification (for reading exp, etc.).
 *
 * @param {string} token
 * @returns {object|null}
 */
const decodeToken = (token) => jwt.decode(token);

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifySocketToken,
  decodeToken,
};
