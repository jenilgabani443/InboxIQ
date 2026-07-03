'use strict';

const mongoose = require('mongoose');

module.exports = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
  }
};
