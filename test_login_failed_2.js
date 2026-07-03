require('dotenv').config();
const mongoose = require('mongoose');
const env = require('./src/config/env');
const authService = require('./src/modules/auth/auth.service');
const { AuditLog } = require('./src/modules/audit/audit.model');

async function test() {
  await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });

  try {
    const user = {
      email: `failed_test_${Date.now()}@inboxiq.app`,
      password: 'Test@1234!',
      displayName: `Failed Test`,
    };
    await authService.register(user);

    // Now let's try to login with a bad password directly using the service
    try {
      await authService.login({
        email: user.email,
        password: 'WrongPassword!',
        ip: '127.0.0.1',
        userAgent: 'test'
      });
    } catch (e) {
      console.log('Login failed as expected');
    }

    // Since we fixed auth.controller.js to await auditService, wait, the controller is what calls auditService for LOGIN_FAILED!
    // The service DOES NOT log LOGIN_FAILED!
    // Let me simulate the controller.
    const { login } = require('./src/modules/auth/auth.controller');
    const httpMocks = require('node-mocks-http');
    const req = httpMocks.createRequest({
      method: 'POST',
      url: '/api/v1/auth/login',
      body: {
        email: user.email,
        password: 'WrongPassword!'
      }
    });
    const res = httpMocks.createResponse();

    try {
      await login(req, res, (err) => {
        if (err) console.error('Next called with error:', err.message);
      });
    } catch (err) {
      console.log('Controller threw:', err.message);
    }

    const logs = await AuditLog.find({ action: 'LOGIN_FAILED' });
    console.log('Found LOGIN_FAILED logs:', logs.length);
  } catch (err) {
    console.error('Outer Error:', err);
  }

  await mongoose.disconnect();
}
test();
