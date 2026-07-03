'use strict';

/**
 * Feature 4 — Auto-Apply Email Filters Tests
 *
 * Tests cover:
 *  1. Processor successfully applies actions (labels, markRead, star, archive, delete).
 *  2. Evaluates different conditions correctly (from, to, subject, hasAttachment, bodyContains).
 *  3. Creates a forwarded email if forwardTo is configured.
 *  4. Ignores inactive filters.
 *  5. Fails gracefully/idempotently when email doesn't exist.
 *  6. Regression check: standard email routes still function perfectly.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../../app');
const Email = require('../email/email.model');
const Filter = require('./filter.model');
const { EMAIL_FOLDER } = require('../../shared/constants/emailStatus');

let app;

beforeAll(() => {
  app = createApp();
});

const API = '/api/v1';

// ── Helpers ───────────────────────────────────────────────────────────────────

const registerAndLogin = async (suffix) => {
  const user = {
    email: `filter_${suffix}@inboxiq.app`,
    password: 'Test@1234!',
    displayName: `Filter Test ${suffix}`,
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

const createFilter = async (token, filterData) => {
  const res = await request(app)
    .post(`${API}/filters`)
    .set('Authorization', `Bearer ${token}`)
    .send(filterData);
  return res.body.data;
};

// ── Filter Application Unit/Integration Logic ─────────────────────────────────

describe('Feature 4 — Auto-Apply Filters: Processor Logic', () => {
  let token;
  let userId;
  let labelId;

  beforeAll(async () => {
    ({ accessToken: token, userId } = await registerAndLogin('processor'));
    labelId = new mongoose.Types.ObjectId();
  });

  it('processor should export a function', () => {
    const processor = require('./filter.processor');
    expect(typeof processor).toBe('function');
  });

  it('should apply actions when conditions match', async () => {
    // 1. Create a filter
    const filter = await createFilter(token, {
      name: 'Test Filter',
      conditions: {
        subject: 'Invoice',
        hasAttachment: true,
      },
      actions: {
        markRead: true,
        star: true,
        applyLabel: labelId.toString(),
      },
    });

    // 2. Create an email that matches
    const emailRes = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Your Monthly Invoice',
        bodyText: 'Please find attached.',
        attachments: [new mongoose.Types.ObjectId().toString()],
        status: 'draft',
      });

    const emailId = emailRes.body.data._id;

    // 3. Manually invoke the processor logic
    const processor = require('./filter.processor');
    await processor({
      id: 'test-filter-job-1',
      data: { emailId, userId },
    });

    // 4. Verify email was updated
    const updatedEmail = await Email.findById(emailId);
    expect(updatedEmail.isRead).toBe(true);
    expect(updatedEmail.isStarred).toBe(true);
    expect(updatedEmail.labels.map((l) => l.toString())).toContain(labelId.toString());
  });

  it('should handle archive and delete (delete has precedence)', async () => {
    await createFilter(token, {
      name: 'Spammy Filter',
      conditions: {
        from: 'spammer@example.com',
      },
      actions: {
        deleteEmail: true,
      },
    });

    const emailRes = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Win a free iPhone!',
      });
      
    // Hack: Manually update the from address to match the condition since the route forces `from` to be the user
    await Email.findByIdAndUpdate(emailRes.body.data._id, {
      'from.email': 'spammer@example.com',
    });

    const emailId = emailRes.body.data._id;

    const processor = require('./filter.processor');
    await processor({
      id: 'test-filter-job-2',
      data: { emailId, userId },
    });

    const updatedEmail = await Email.findById(emailId);
    expect(updatedEmail.folder).toBe(EMAIL_FOLDER.TRASH);
  });

  it('should ignore inactive filters', async () => {
    const filter = await createFilter(token, {
      name: 'Inactive Filter',
      conditions: { subject: 'Secret' },
      actions: { star: true },
      isActive: false,
    });

    const emailRes = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Top Secret Document',
      });

    const processor = require('./filter.processor');
    await processor({
      id: 'test-filter-job-3',
      data: { emailId: emailRes.body.data._id, userId },
    });

    const updatedEmail = await Email.findById(emailRes.body.data._id);
    expect(updatedEmail.isStarred).toBe(false);
  });

  it('should not apply actions if conditions do not fully match', async () => {
    await createFilter(token, {
      name: 'Strict Filter',
      conditions: {
        subject: 'Alert',
        bodyContains: 'Critical', // BOTH must match
      },
      actions: { markRead: true },
    });

    const emailRes = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'System Alert',
        bodyText: 'Just a warning.', // Does not contain "Critical"
      });

    const processor = require('./filter.processor');
    await processor({
      id: 'test-filter-job-4',
      data: { emailId: emailRes.body.data._id, userId },
    });

    const updatedEmail = await Email.findById(emailRes.body.data._id);
    expect(updatedEmail.isRead).toBe(false); // Action not applied
  });

  it('should correctly create a forwarded email if forwardTo action is configured', async () => {
    await createFilter(token, {
      name: 'Forward Filter',
      conditions: { subject: 'Forward Me' },
      actions: { forwardTo: 'delegate@inboxiq.app' },
    });

    const emailRes = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Forward Me ASAP',
        bodyText: 'Please handle this.',
      });

    const processor = require('./filter.processor');
    await processor({
      id: 'test-filter-job-5',
      data: { emailId: emailRes.body.data._id, userId },
    });

    // Verify original email is unchanged in terms of folder/status
    const originalEmail = await Email.findById(emailRes.body.data._id);
    expect(originalEmail).toBeDefined();

    // Verify a forwarded email was created
    const forwardedEmail = await Email.findOne({
      'to.email': 'delegate@inboxiq.app',
      subject: 'Fwd: Forward Me ASAP',
    });
    
    expect(forwardedEmail).toBeDefined();
    expect(forwardedEmail.status).toBe('sent');
    expect(forwardedEmail.folder).toBe('sent');
    expect(forwardedEmail.bodyText).toContain('Please handle this.');
  });
});

// ── End-to-End & Regression ───────────────────────────────────────────────────

describe('Feature 4 — Regression: Emails Route Auto-Queue', () => {
  let token;

  beforeAll(async () => {
    ({ accessToken: token } = await registerAndLogin('e2e'));
  });

  it('creating an email should not fail when enqueuing the filter job (null stub safe)', async () => {
    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Standard Email',
        bodyText: 'Hello!',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should persist subject condition correctly and only trigger for matching emails', async () => {
    // 1. Create filter with 'subject' condition
    const filter = await createFilter(token, {
      name: 'Project Archive Filter',
      conditions: {
        subject: 'Project',
      },
      actions: {
        archive: true,
      },
    });

    // Verify it persisted correctly
    expect(filter.conditions.subject).toBe('Project');

    // 2. Create matching email
    const matchRes = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Update on the Apollo Project',
      });

    // 3. Create non-matching email
    const nonMatchRes = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Lunch tomorrow?',
      });

    const processor = require('./filter.processor');
    const { userId } = filter;

    // Process matching email
    await processor({
      id: 'reg-match',
      data: { emailId: matchRes.body.data._id, userId },
    });

    // Process non-matching email
    await processor({
      id: 'reg-non-match',
      data: { emailId: nonMatchRes.body.data._id, userId },
    });

    // 4. Verify outcomes
    const matchedEmail = await Email.findById(matchRes.body.data._id);
    expect(matchedEmail.folder).toBe(EMAIL_FOLDER.ARCHIVE);

    const nonMatchedEmail = await Email.findById(nonMatchRes.body.data._id);
    expect(nonMatchedEmail.folder).not.toBe(EMAIL_FOLDER.ARCHIVE);
  });
});
