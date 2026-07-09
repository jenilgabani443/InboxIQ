require('dotenv').config();
const mongoose = require('mongoose');
const aiService = require('./src/modules/ai/ai.service');
const Label = require('./src/modules/label/label.model');
const Email = require('./src/modules/email/email.model');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/inboxiq');
  
  const email = new Email({
    threadId: new mongoose.Types.ObjectId(),
    from: { userId: new mongoose.Types.ObjectId(), email: 'test@example.com' },
    to: [{ email: 'test2@example.com' }],
    subject: 'URGENT: Project deployment ASAP',
    bodyText: 'This is critical. Please review immediately.',
  });
  
  await email.save();
  
  const result = await aiService.calculatePriorityScore(email._id);
  console.log('Result:', result);
  
  await mongoose.disconnect();
}

test().catch(console.error);
