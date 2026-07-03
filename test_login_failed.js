require('dotenv').config();
const mongoose = require('mongoose');
const env = require('./src/config/env');
const { AuditLog } = require('./src/modules/audit/audit.model');
const auditService = require('./src/modules/audit/audit.service');
const { User } = require('./src/modules/user/user.model');

async function test() {
  await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
  
  // Find a user
  const user = await User.findOne({});
  console.log('User found:', user?._id);

  if (user) {
    try {
      await auditService.logAudit({
        userId: user._id,
        action: 'LOGIN_FAILED',
        ip: '127.0.0.1',
        userAgent: 'test-agent',
        metadata: { reason: 'test script' }
      });
      console.log('Audit log created');
    } catch (err) {
      console.error('Error:', err);
    }
  }

  await mongoose.disconnect();
}
test();
