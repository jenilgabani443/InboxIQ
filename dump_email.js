const mongoose = require('mongoose');
const Email = require('./src/modules/email/email.model');

async function dump() {
  await mongoose.connect('mongodb://localhost:27017/inboxiq');
  const emails = await Email.find({ subject: /URGENT: Project deployment ASAP/i }).lean();
  console.log('Found emails:', emails.length);
  emails.forEach(e => {
    console.log('Email ID:', e._id);
    console.log('Subject:', e.subject);
    console.log('isRead:', e.isRead);
    console.log('createdAt:', e.createdAt);
    console.log('score:', e.priorityScore);
    console.log('regex test:', /(urgent|asap|immediately|critical)/i.test(e.subject));
  });
  await mongoose.disconnect();
}
dump().catch(console.error);
