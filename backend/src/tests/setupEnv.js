'use strict';

const mongoose = require('mongoose');
const { getRedisClient } = require('../config/redis');

beforeAll(async () => {
  if (process.env.MONGO_TEST_URI) {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_TEST_URI);
    }
    // Clean DB before each test suite
    await mongoose.connection.dropDatabase();
    
    // Ensure all indexes (especially $text) are fully built before tests run
    await Promise.all(
      Object.values(mongoose.models).map((model) => model.createIndexes())
    );
  }
});

afterAll(async () => {
  // Disconnect mongoose for this worker
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  
  // Close mock redis if connected
  const redis = getRedisClient();
  if (redis && redis.status === 'ready') {
    await redis.quit();
  }
});
