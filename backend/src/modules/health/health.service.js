'use strict';

const mongoose = require('mongoose');

const env = require('../../config/env');

class HealthService {
  getLiveness() {
    return {
      status: 'UP',
      timestamp: new Date().toISOString()
    };
  }

  getReadiness() {
    const {readyState} = mongoose.connection;
    const dbStatusMap = {
      0: 'DISCONNECTED',
      1: 'CONNECTED',
      2: 'CONNECTING',
      3: 'DISCONNECTING'
    };

    const database = dbStatusMap[readyState] || 'UNKNOWN';

    return {
      status: 'READY',
      database,
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new HealthService();
