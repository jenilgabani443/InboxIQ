'use strict';

require('dotenv').config({ path: '.env' });
process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = '4'; // Fast hashing in tests

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  // Start in-memory MongoDB instance
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  // Expose it to the test runners via env var (passed to workers)
  process.env.MONGO_TEST_URI = uri;
  global.__MONGOD__ = mongod;

  // Connect mongoose in the global setup context (optional, but good for initial DB creation/indexes)
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
};
