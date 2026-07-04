'use strict';

const mongoose = require('mongoose');

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
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new HealthService();
