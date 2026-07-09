require('dotenv').config();
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('./src/app');
const User = require('./src/modules/user/user.model');
const tokenUtils = require('./src/shared/utils/tokenUtils');
const Email = require('./src/modules/email/email.model');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/inboxiq');
  
  let user = await User.findOne({ email: 'test_manual4@inboxiq.app' });
  if (!user) {
    user = await User.create({
      email: 'test_manual4@inboxiq.app',
      name: 'Manual Test',
      displayName: 'Manual Test',
      passwordHash: 'dummy',
      role: 'user',
    });
  }
  
  const token = tokenUtils.generateAccessToken({ id: user._id.toString(), email: user.email, role: user.role });
  
  const res = await request(app)
    .post('/api/v1/emails')
    .set('Authorization', `Bearer ${token}`)
    .send({
      to: [{ email: 'recipient@example.com' }],
      subject: 'URGENT: Project deployment ASAP',
      bodyText: 'This is critical. Please review immediately.',
      status: 'draft',
    });
    
  console.log('Created email response status:', res.status);
  
  if (res.status === 201) {
    const emailId = res.body.data._id;
    
    const emailDoc = await Email.findById(emailId).lean();
    console.log('Email Doc in DB Subject:', emailDoc.subject);
    console.log('Email Doc in DB isRead:', emailDoc.isRead);
    console.log('Email Doc in DB createdAt:', emailDoc.createdAt);
    
    const aiRes = await request(app)
      .get(`/api/v1/ai/priority/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
      
    console.log('AI Priority Response:', aiRes.body);
  } else {
    console.log('Email creation failed:', res.body);
  }
  
  await mongoose.disconnect();
}

run().catch(console.error);
