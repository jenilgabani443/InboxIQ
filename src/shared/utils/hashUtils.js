'use strict';

const bcrypt = require('bcryptjs');
const env = require('../../config/env');

/**
 * Hashes a plain text password using bcrypt.
 *
 * @param {string} password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(env.BCRYPT_ROUNDS);
  return bcrypt.hash(password, salt);
};

/**
 * Compares a plain text password against a bcrypt hash.
 *
 * @param {string} password - Plain text input
 * @param {string} hash - Stored bcrypt hash
 * @returns {Promise<boolean>}
 */
const comparePassword = async (password, hash) => bcrypt.compare(password, hash);

module.exports = { hashPassword, comparePassword };
