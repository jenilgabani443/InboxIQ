'use strict';

require('dotenv').config({ path: '.env' });
process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = '4'; // Fast hashing in tests

const mongoose = require('mongoose');
const env = require('../config/env');

module.exports = async () => {
  await mongoose.connect(env.MONGO_TEST_URI || env.MONGO_URI);
  // Clean test DB before suite
  await mongoose.connection.dropDatabase();
  global.__MONGO_URI__ = env.MONGO_TEST_URI || env.MONGO_URI;
};
