require('dotenv').config();
const mongoose = require('mongoose');
const aiService = require('./src/modules/ai/ai.service');
const Email = require('./src/modules/email/email.model');
const Label = require('./src/modules/label/label.model');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/inboxiq');
  
  // Create email with exact parameters user specified
  const email = new Email({
    threadId: new mongoose.Types.ObjectId(),
    from: { userId: new mongoose.Types.ObjectId(), email: 'test@example.com' },
    to: [{ email: 'recipient@example.com' }],
    subject: 'URGENT: Project deployment ASAP',
    bodyText: 'This is critical. Please review immediately.',
  });
  
  await email.save();
  
  const result = await aiService.calculatePriorityScore(email._id);
  console.log('Result:', result);
  
  await mongoose.disconnect();
}

test().catch(console.error);
