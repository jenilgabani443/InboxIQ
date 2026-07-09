'use strict';

/**
 * Feature 5 — Bulk Operations Tests
 *
 * Tests cover:
 *  1. Validation (missing emailIds, invalid operation, missing labels for label ops).
 *  2. Successful bulk markRead and markUnread.
 *  3. Successful bulk archive.
 *  4. Successful bulk restore.
 *  5. Successful bulk applyLabels and removeLabels.
 *  6. Bulk Trash behavior (moving to trash vs permanent deletion if already in trash).
 *  7. Correctly counting successful vs failed (e.g. invalid IDs or other user's IDs).
 *  8. Atomicity and idempotency.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../../app');
const Email = require('./email.model');
const { EMAIL_FOLDER } = require('../../shared/constants/emailStatus');

let app;

beforeAll(() => {
  app = createApp();
});

const API = '/api/v1';

// ── Helpers ───────────────────────────────────────────────────────────────────

const registerAndLogin = async (suffix) => {
  const user = {
    email: `bulk_${suffix}@inboxiq.app`,
    password: 'Test@1234!',
    displayName: `Bulk Test ${suffix}`,
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

const createEmails = async (token, count = 3, folder = EMAIL_FOLDER.INBOX) => {
  const emails = [];
  for (let i = 0; i < count; i++) {
    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: `Bulk Test ${i}`,
        status: 'draft',
      });
    
    const emailId = res.body.data._id;
    await Email.findByIdAndUpdate(emailId, { folder });
    emails.push(emailId);
  }
  return emails;
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Feature 5 — Bulk Operations', () => {
  let token;
  let userId;

  beforeAll(async () => {
    ({ accessToken: token, userId } = await registerAndLogin('ops'));
  });

  describe('Validation', () => {
    it('should reject when emailIds is missing or empty', async () => {
      const res = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ operation: 'markRead' });
      expect(res.status).toBe(422);

      const res2 = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds: [], operation: 'markRead' });
      expect(res2.status).toBe(422);
    });

    it('should reject when operation is invalid', async () => {
      const res = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds: [new mongoose.Types.ObjectId().toString()], operation: 'invalidOp' });
      expect(res.status).toBe(422);
    });

    it('should reject applyLabels if labels array is missing', async () => {
      const res = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds: [new mongoose.Types.ObjectId().toString()], operation: 'applyLabels' });
      expect(res.status).toBe(422);
    });
  });

  describe('Read / Unread', () => {
    it('should bulk markRead', async () => {
      const emailIds = await createEmails(token, 2);
      const res = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds, operation: 'markRead' });

      expect(res.status).toBe(200);
      expect(res.body.data.successful).toBe(2);

      const emails = await Email.find({ _id: { $in: emailIds } });
      emails.forEach(e => {
        expect(e.isRead).toBe(true);
        expect(e.readAt).toBeDefined();
      });
    });

    it('should bulk markUnread', async () => {
      const emailIds = await createEmails(token, 2);
      await Email.updateMany({ _id: { $in: emailIds } }, { isRead: true, readAt: new Date() });

      const res = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds, operation: 'markUnread' });

      expect(res.status).toBe(200);
      expect(res.body.data.successful).toBe(2);

      const emails = await Email.find({ _id: { $in: emailIds } });
      emails.forEach(e => {
        expect(e.isRead).toBe(false);
        expect(e.readAt).toBeNull();
      });
    });
  });

  describe('Archive / Restore', () => {
    it('should bulk archive', async () => {
      const emailIds = await createEmails(token, 2);
      const res = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds, operation: 'archive' });

      expect(res.status).toBe(200);
      const emails = await Email.find({ _id: { $in: emailIds } });
      emails.forEach(e => expect(e.folder).toBe(EMAIL_FOLDER.ARCHIVE));
    });

    it('should bulk restore from trash', async () => {
      const emailIds = await createEmails(token, 2, EMAIL_FOLDER.TRASH);
      const res = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds, operation: 'restore' });

      expect(res.status).toBe(200);
      const emails = await Email.find({ _id: { $in: emailIds } });
      emails.forEach(e => expect(e.folder).toBe(EMAIL_FOLDER.INBOX));
    });
  });

  describe('Trash / Delete', () => {
    it('should move to trash if not already in trash', async () => {
      const emailIds = await createEmails(token, 2);
      const res = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds, operation: 'trash' });

      expect(res.status).toBe(200);
      const emails = await Email.find({ _id: { $in: emailIds } });
      emails.forEach(e => {
        expect(e.folder).toBe(EMAIL_FOLDER.TRASH);
        expect(e.isDeleted).toBe(false);
      });
    });

    it('should permanently (soft) delete if already in trash', async () => {
      const emailIds = await createEmails(token, 2, EMAIL_FOLDER.TRASH);
      const res = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds, operation: 'trash' });

      expect(res.status).toBe(200);
      const emails = await Email.find({ _id: { $in: emailIds } });
      emails.forEach(e => {
        expect(e.folder).toBe(EMAIL_FOLDER.TRASH);
        expect(e.isDeleted).toBe(true);
        expect(e.deletedAt).toBeDefined();
      });
    });

    it('should handle a mix of inbox and trash emails atomically', async () => {
      const inboxIds = await createEmails(token, 2, EMAIL_FOLDER.INBOX);
      const trashIds = await createEmails(token, 2, EMAIL_FOLDER.TRASH);
      
      const allIds = [...inboxIds, ...trashIds];
      const res = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds: allIds, operation: 'trash' });

      expect(res.status).toBe(200);
      expect(res.body.data.successful).toBe(4);

      const allEmails = await Email.find({ _id: { $in: allIds } });
      allEmails.forEach(e => {
        expect(e.folder).toBe(EMAIL_FOLDER.TRASH);
        if (inboxIds.includes(e._id.toString())) {
          expect(e.isDeleted).toBe(false);
        } else {
          expect(e.isDeleted).toBe(true);
        }
      });
    });
  });

  describe('Labels', () => {
    it('should apply and remove labels', async () => {
      const emailIds = await createEmails(token, 2);
      const labelId1 = new mongoose.Types.ObjectId().toString();
      const labelId2 = new mongoose.Types.ObjectId().toString();

      // Apply
      const resApply = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds, operation: 'applyLabels', labels: [labelId1, labelId2] });
      expect(resApply.status).toBe(200);

      let emails = await Email.find({ _id: { $in: emailIds } });
      emails.forEach(e => {
        expect(e.labels.map(l => l.toString())).toContain(labelId1);
        expect(e.labels.map(l => l.toString())).toContain(labelId2);
      });

      // Remove
      const resRemove = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds, operation: 'removeLabels', labels: [labelId1] });
      expect(resRemove.status).toBe(200);

      emails = await Email.find({ _id: { $in: emailIds } });
      emails.forEach(e => {
        expect(e.labels.map(l => l.toString())).not.toContain(labelId1);
        expect(e.labels.map(l => l.toString())).toContain(labelId2);
      });
    });
  });

  describe('Security and Resilience', () => {
    it('should skip emails belonging to another user and report failed counts', async () => {
      const { accessToken: tokenB } = await registerAndLogin('userB');
      const otherUserEmailIds = await createEmails(tokenB, 1);
      const myEmailIds = await createEmails(token, 1);

      const emailIds = [...myEmailIds, ...otherUserEmailIds];

      const res = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds, operation: 'archive' });

      expect(res.status).toBe(200);
      expect(res.body.data.successful).toBe(1);
      expect(res.body.data.failed).toBe(1);

      // Verify the other user's email was not modified
      const otherEmail = await Email.findById(otherUserEmailIds[0]);
      expect(otherEmail.folder).not.toBe(EMAIL_FOLDER.ARCHIVE);
    });

    it('should ignore invalid MongoDB ObjectIds without throwing 500', async () => {
      const myEmailIds = await createEmails(token, 1);
      const emailIds = [...myEmailIds, 'not-a-valid-id', '123456789012'];

      const res = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds, operation: 'markRead' });

      expect(res.status).toBe(200);
      expect(res.body.data.successful).toBe(1);
      expect(res.body.data.failed).toBe(2);
    });
  });

  describe('Regression: Response Counting Logic', () => {
    it('should correctly report successful vs failed based on MongoDB matchedCount (archiving an already archived email)', async () => {
      // Create 2 emails and archive them initially
      const emailIds = await createEmails(token, 2, EMAIL_FOLDER.ARCHIVE);
      
      // Try to bulk archive them again
      const res = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds, operation: 'archive' });
      
      expect(res.status).toBe(200);
      
      // Since they were already archived, the filter { folder: { $nin: [...] } } will NOT match them.
      // Therefore matchedCount is 0, successful is 0, failed is 2.
      expect(res.body.data.successful).toBe(0);
      expect(res.body.data.failed).toBe(2);
      expect(res.body.data.modified).toBe(0);
    });

    it('should correctly report successful count when emails are actually updated', async () => {
      const emailIds = await createEmails(token, 3, EMAIL_FOLDER.INBOX);
      
      const res = await request(app)
        .patch(`${API}/emails/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds, operation: 'archive' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.successful).toBe(3);
      expect(res.body.data.failed).toBe(0);
      expect(res.body.data.modified).toBe(3);
    });
  });
});
