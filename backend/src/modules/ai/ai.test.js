'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../../app');
const Email = require('../email/email.model');
const { EMAIL_FOLDER } = require('../../shared/constants/emailStatus');

let app;

beforeAll(() => {
  app = createApp();
});

const API = '/api/v1';

const registerAndLogin = async (suffix) => {
  const user = {
    email: `ai_${suffix}@inboxiq.app`,
    password: 'Test@1234!',
    displayName: `AI Test ${suffix}`,
  };
  await request(app).post(`${API}/auth/register`).send(user);
  const loginRes = await request(app).post(`${API}/auth/login`).send({
    email: user.email,
    password: user.password,
  });
  return {
    accessToken: loginRes.body.data.accessToken,
    userId: loginRes.body.data.user.id,
  };
};

describe('Feature 1 — Smart Reply Suggestions', () => {
  let token;
  let userId;

  beforeAll(async () => {
    ({ accessToken: token, userId } = await registerAndLogin('replies'));
  });

  const createEmailWithContent = async (subject, bodyText) => {
    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject,
        bodyText,
        status: 'draft',
      });
    return res.body.data._id;
  };

  it('should return 404 if email does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`${API}/ai/smart-replies/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return meeting replies for meeting keywords', async () => {
    const emailId = await createEmailWithContent('Catch up', 'Let us schedule a zoom call for tomorrow');
    const res = await request(app)
      .get(`${API}/ai/smart-replies/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.suggestions).toContain("Sounds good. I'll be there.");
    expect(res.body.data.suggestions.length).toBe(3);
  });

  it('should return thank-you replies for thank you keywords', async () => {
    const emailId = await createEmailWithContent('Help received', 'I appreciate your help. Thanks!');
    const res = await request(app)
      .get(`${API}/ai/smart-replies/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.suggestions).toContain("You're welcome!");
  });

  it('should return invoice replies for invoice keywords', async () => {
    const emailId = await createEmailWithContent('Monthly Invoice', 'Please find attached the billing receipt.');
    const res = await request(app)
      .get(`${API}/ai/smart-replies/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.suggestions).toContain("I'll review the invoice and get back to you.");
  });

  it('should return approval replies for approval keywords', async () => {
    const emailId = await createEmailWithContent('Please review', 'Kindly approve the changes.');
    const res = await request(app)
      .get(`${API}/ai/smart-replies/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.suggestions).toContain("I'll review and respond soon.");
  });

  it('should return urgent replies for urgent keywords', async () => {
    const emailId = await createEmailWithContent('Issue in production', 'This is urgent, please fix asap.');
    const res = await request(app)
      .get(`${API}/ai/smart-replies/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.suggestions).toContain("Acknowledged. I'll prioritize this.");
  });

  it('should return generic fallback replies if no keyword matches', async () => {
    const emailId = await createEmailWithContent('Random thought', 'Just wanted to say hi.');
    const res = await request(app)
      .get(`${API}/ai/smart-replies/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.suggestions).toContain("Thanks! I'll review this shortly.");
  });
});

describe('Feature 2 — Priority Scoring Engine', () => {
  let token;
  let userId;

  beforeAll(async () => {
    ({ accessToken: token, userId } = await registerAndLogin('priority'));
  });

  const createEmailWithOptions = async (options) => {
    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: options.subject || 'Test',
        bodyText: 'Hello',
        status: 'draft',
      });
    const emailId = res.body.data._id;
    
    // Manually update properties for tests that the POST endpoint might not expose easily
    if (options.isRead || options.fromEmail || options.createdAt || options.attachments || options.labels) {
      const update = {};
      if (options.isRead !== undefined) update.isRead = options.isRead;
      if (options.fromEmail) update['from.email'] = options.fromEmail;
      if (options.createdAt) update.createdAt = options.createdAt;
      if (options.attachments) update.attachments = options.attachments;
      if (options.labels) update.labels = options.labels;

      // Use updateOne to bypass mongoose timestamp updates for createdAt
      await Email.updateOne({ _id: emailId }, { $set: update }, { timestamps: false, strict: false });
    }

    return emailId;
  };

  it('should return 404 if email not found', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`${API}/ai/priority/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('should calculate Low priority (score <= 30)', async () => {
    // Read (-10), older than 7 days (-10), base (50) = 30 -> Low
    const emailId = await createEmailWithOptions({
      isRead: true,
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    });
    
    const res = await request(app)
      .get(`${API}/ai/priority/${emailId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.priorityScore).toBe(30);
    expect(res.body.data.priority).toBe('Low');
  });

  it('should calculate Medium priority (31-70)', async () => {
    // Unread (+10), base (50), no other modifiers = 60 -> Medium
    // Note: recently created adds +10, so base(50) + unread(+10) + recent(+10) = 70 -> Medium
    const emailId = await createEmailWithOptions({
      isRead: false
    });
    
    const res = await request(app)
      .get(`${API}/ai/priority/${emailId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.priorityScore).toBe(70);
    expect(res.body.data.priority).toBe('Medium');
  });

  it('should calculate High priority (>= 71)', async () => {
    // Base (50) + Urgent subject (+20) + recent (+10) + unread (+10) = 90 -> High
    const emailId = await createEmailWithOptions({
      subject: 'This is Urgent please',
      isRead: false
    });
    
    const res = await request(app)
      .get(`${API}/ai/priority/${emailId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.priorityScore).toBe(90);
    expect(res.body.data.priority).toBe('High');
  });

  it('should boost score for important sender and attachments', async () => {
    // Base(50) + Important(+10) + Attachments(+10) + recent(+10) + unread(+10) = 90
    const emailId = await createEmailWithOptions({
      fromEmail: 'boss@inboxiq.app',
      attachments: [new mongoose.Types.ObjectId()],
      isRead: false
    });
    
    const res = await request(app)
      .get(`${API}/ai/priority/${emailId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.priorityScore).toBe(90);
  });
});


describe('Feature 3 — Auto Labeling by Content', () => {
  let token;
  let userId;

  beforeAll(async () => {
    ({ accessToken: token, userId } = await registerAndLogin('autolabel'));
  });

  const createEmail = async (subject, bodyText) => {
    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject,
        bodyText,
        status: 'draft',
      });
    return res.body.data._id;
  };

  it('should return 404 if email not found', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`${API}/ai/auto-label/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('should return empty array if no keywords match', async () => {
    const emailId = await createEmail('Random stuff', 'Nothing to see here');
    const res = await request(app)
      .post(`${API}/ai/auto-label/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('No labels matched');
    expect(res.body.data.labels.length).toBe(0);
  });

  it('should apply Invoice label for invoice keywords', async () => {
    const emailId = await createEmail('Monthly billing', 'Please see the receipt attached.');
    const res = await request(app)
      .post(`${API}/ai/auto-label/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.labels[0].name).toBe('Invoice');
    expect(res.body.data.labels[0].color).toBe('#10B981');
  });

  it('should apply Meeting label for meeting keywords', async () => {
    const emailId = await createEmail('Sync up', 'Let us schedule a zoom call.');
    const res = await request(app)
      .post(`${API}/ai/auto-label/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.labels[0].name).toBe('Meeting');
  });

  it('should apply Urgent label for urgent keywords', async () => {
    const emailId = await createEmail('Critical issue', 'Please look into this immediately.');
    const res = await request(app)
      .post(`${API}/ai/auto-label/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.labels[0].name).toBe('Urgent');
  });

  it('should apply Support label for support keywords', async () => {
    const emailId = await createEmail('Help needed', 'I found a bug in the system.');
    const res = await request(app)
      .post(`${API}/ai/auto-label/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.labels[0].name).toBe('Support');
  });

  it('should apply Newsletter label for newsletter keywords', async () => {
    const emailId = await createEmail('Marketing promotion', 'Unsubscribe from our newsletter.');
    const res = await request(app)
      .post(`${API}/ai/auto-label/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.labels[0].name).toBe('Newsletter');
  });

  it('should apply multiple labels and reuse existing labels without duplicating', async () => {
    const emailId = await createEmail('Urgent zoom meeting', 'We need to discuss the invoice billing ASAP.');
    
    // First run creates the labels
    let res = await request(app)
      .post(`${API}/ai/auto-label/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.labels.length).toBe(3); // Urgent, Meeting, Invoice
    const names = res.body.data.labels.map(l => l.name);
    expect(names).toContain('Urgent');
    expect(names).toContain('Meeting');
    expect(names).toContain('Invoice');
    
    // Second run should reuse them and not duplicate
    res = await request(app)
      .post(`${API}/ai/auto-label/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.labels.length).toBe(3); // Still 3
    
    // Check the DB directly to ensure labels array in email isn't duplicated
    const email = await Email.findById(emailId);
    expect(email.labels.length).toBe(3);
  });
});

describe('Feature 4 — Thread Summarization', () => {
  let token;
  let userId;
  const Thread = require('../thread/thread.model');

  beforeAll(async () => {
    ({ accessToken: token, userId } = await registerAndLogin('summarize'));
  });

  const createEmailForThread = async (threadId, subject, bodyText, fromName, fromEmail, toEmail) => {
    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: toEmail || 'recipient@example.com' }],
        subject,
        bodyText,
        status: 'sent',
      });
    const emailId = res.body.data._id;
    // Overwrite fields to simulate multiple senders inside the same thread
    const update = { threadId };
    if (fromName || fromEmail) {
      update.from = { userId, name: fromName || '', email: fromEmail || `user@inboxiq.app` };
    }
    await Email.updateOne({ _id: emailId }, { $set: update }, { timestamps: false, strict: false });
    return emailId;
  };

  it('should return 404 if thread not found', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`${API}/ai/summary/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('should return 403 if user is not a participant in the thread', async () => {
    const thread = await Thread.create({
      subject: 'Top Secret',
      participants: [new mongoose.Types.ObjectId()] // Not the current user
    });
    
    const res = await request(app)
      .get(`${API}/ai/summary/${thread._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('should return empty thread message if thread has no emails', async () => {
    const thread = await Thread.create({
      subject: 'Empty Thread',
      participants: [userId]
    });
    
    const res = await request(app)
      .get(`${API}/ai/summary/${thread._id}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Thread is empty');
    expect(res.body.data.summary).toBe('No messages found.');
  });

  it('should summarize a single email thread correctly', async () => {
    const thread = await Thread.create({
      subject: 'Single Email',
      participants: [userId]
    });
    
    await createEmailForThread(thread._id, 'Single Email', 'This is a test snippet.', 'Sarthak', 'sarthak@example.com', 'jenil@example.com');

    const res = await request(app)
      .get(`${API}/ai/summary/${thread._id}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Thread summary generated');
    expect(res.body.data.subject).toBe('Single Email');
    expect(res.body.data.messageCount).toBe(1);
    expect(res.body.data.latestSender).toBe('Sarthak');
    expect(res.body.data.participants).toContain('Sarthak');
    expect(res.body.data.participants).toContain('jenil@example.com');
    expect(res.body.data.summary).toContain('Conversation about \'Single Email\' containing 1 message between Sarthak and jenil@example.com');
    expect(res.body.data.summary).toContain('They wrote: "This is a test snippet."');
  });

  it('should summarize a multi-email thread with correct participant extraction', async () => {
    const thread = await Thread.create({
      subject: 'Project Alpha',
      participants: [userId]
    });
    
    // Older email
    await createEmailForThread(thread._id, 'Project Alpha', 'Are we ready?', 'Jenil Gabani', 'jenil@inboxiq.app', 'sarthak@example.com');
    
    // Newer email
    await createEmailForThread(thread._id, 'Re: Project Alpha', 'I have finished the deployment.', 'Sarthak', 'sarthak@example.com', 'jenil@inboxiq.app');

    const res = await request(app)
      .get(`${API}/ai/summary/${thread._id}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.messageCount).toBe(2);
    expect(res.body.data.latestSender).toBe('Sarthak');
    expect(res.body.data.participants).toContain('Jenil Gabani');
    expect(res.body.data.participants).toContain('Sarthak');
    
    // Ensure unique participants
    const uniqueParticipants = [...new Set(res.body.data.participants)];
    expect(res.body.data.participants.length).toBe(uniqueParticipants.length);

    expect(res.body.data.summary).toContain('Conversation about \'Project Alpha\' containing 2 messages between Jenil Gabani and Sarthak.');
    expect(res.body.data.summary).toContain('The latest update was sent by Sarthak. They wrote: "I have finished the deployment."');
  });
});

describe('Feature 5 — Unsubscribe Detection', () => {
  let token;
  let userId;

  beforeAll(async () => {
    ({ accessToken: token, userId } = await registerAndLogin('unsub'));
  });

  const createEmailWithOptions = async (subject, bodyText, headers) => {
    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject,
        bodyText,
        status: 'draft',
      });
    const emailId = res.body.data._id;
    if (headers) {
      await Email.updateOne({ _id: emailId }, { $set: { headers } }, { timestamps: false, strict: false });
    }
    return emailId;
  };

  it('should return 404 if email not found', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`${API}/ai/unsubscribe/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('should return 403 if unauthorized access', async () => {
    const { accessToken: otherToken } = await registerAndLogin('otheruser');
    const emailId = await createEmailWithOptions('Test', 'Test');
    const res = await request(app)
      .get(`${API}/ai/unsubscribe/${emailId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  it('should detect unsubscribe option from body keywords (manage preferences)', async () => {
    const emailId = await createEmailWithOptions('Marketing email', 'Please click here to manage preferences.');
    const res = await request(app)
      .get(`${API}/ai/unsubscribe/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.hasUnsubscribe).toBe(true);
    expect(res.body.data.detectedFrom).toBe('body');
    expect(res.body.data.reason).toContain('Keyword \'manage preferences\' found');
  });

  it('should detect unsubscribe option from header', async () => {
    const emailId = await createEmailWithOptions('Header test', 'Normal body text without keywords.', {
      'List-Unsubscribe': '<mailto:unsubscribe@example.com>'
    });
    const res = await request(app)
      .get(`${API}/ai/unsubscribe/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.hasUnsubscribe).toBe(true);
    expect(res.body.data.detectedFrom).toBe('header');
  });

  it('should prefer header over body if both exist', async () => {
    const emailId = await createEmailWithOptions('Mixed test', 'You can unsubscribe here.', {
      'list-unsubscribe': '<http://example.com/unsub>'
    });
    const res = await request(app)
      .get(`${API}/ai/unsubscribe/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.hasUnsubscribe).toBe(true);
    expect(res.body.data.detectedFrom).toBe('header'); // Precedence check
  });

  it('should return no unsubscribe detected if none exist', async () => {
    const emailId = await createEmailWithOptions('Regular email', 'Hey, how are you?');
    const res = await request(app)
      .get(`${API}/ai/unsubscribe/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.hasUnsubscribe).toBe(false);
    expect(res.body.data.detectedFrom).toBeNull();
  });

  it('should detect unsubscribe with mixed casing (UnSubscribe)', async () => {
    const emailId = await createEmailWithOptions('Mixed Case', 'Click to UnSubscribe now!');
    const res = await request(app)
      .get(`${API}/ai/unsubscribe/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.hasUnsubscribe).toBe(true);
    expect(res.body.data.detectedFrom).toBe('body');
    expect(res.body.data.reason).toContain('Keyword \'unsubscribe\' found'); // The matched text converts to lowercase per my implementation
  });

  it('should detect multiple unsubscribe keywords', async () => {
    const emailId = await createEmailWithOptions('Many keywords', 'Stop emails or opt out now.');
    const res = await request(app)
      .get(`${API}/ai/unsubscribe/${emailId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.hasUnsubscribe).toBe(true);
    expect(res.body.data.detectedFrom).toBe('body');
  });
});
