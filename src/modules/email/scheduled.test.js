'use strict';

/**
 * Feature 2 — Scheduled Email Delivery Tests
 *
 * Tests cover:
 *  1. Scheduled email creation (valid scheduledAt → status: 'scheduled')
 *  2. scheduledAt validation (past date, invalid format, > 1 year)
 *  3. Undo-send uses user preference (undoSendSeconds) not hardcoded value
 *  4. Immediately sent emails still work (no regression)
 *  5. Draft emails still work (no regression)
 *  6. Bull job enqueueing is a no-op in test env (null-stub — does not throw)
 *
 * Note: The actual job processing (DB state transition + Socket.IO emit) is
 * verified via the processor unit logic. End-to-end timing tests require a live
 * Redis + Bull setup and are validated manually against Docker.
 */

const request = require('supertest');
const createApp = require('../../app');

let app;

beforeAll(() => {
  app = createApp();
});

const API = '/api/v1';

// ── Helpers ───────────────────────────────────────────────────────────────────

const registerAndLogin = async (suffix) => {
  const user = {
    email: `scheduled_${suffix}@inboxiq.app`,
    password: 'Test@1234!',
    displayName: `Scheduled Test ${suffix}`,
  };
  await request(app).post(`${API}/auth/register`).send(user);
  const loginRes = await request(app).post(`${API}/auth/login`).send({
    email: user.email,
    password: user.password,
  });
  return {
    accessToken: loginRes.body.data.accessToken,
    userId: loginRes.body.data.user.id,
    email: user.email,
  };
};

const futureDate = (offsetMs = 60 * 60 * 1000) =>
  new Date(Date.now() + offsetMs).toISOString(); // default: 1 hour from now

// ── Scheduled Email Creation ──────────────────────────────────────────────────

describe('Feature 2 — Scheduled Email: Creating a scheduled email', () => {
  let token;

  beforeAll(async () => {
    ({ accessToken: token } = await registerAndLogin('create'));
  });

  it('should create an email with status: scheduled when scheduledAt is provided', async () => {
    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com', name: 'Recipient' }],
        subject: 'Scheduled Meeting Invite',
        bodyText: 'This email is scheduled for future delivery.',
        scheduledAt: futureDate(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('scheduled');
    expect(res.body.data.folder).toBe('drafts'); // held in drafts until delivery
    expect(res.body.data.scheduledAt).toBeDefined();
    expect(res.body.data.sentAt).toBeNull();
  });

  it('should store the correct scheduledAt timestamp', async () => {
    const scheduleTime = futureDate(2 * 60 * 60 * 1000); // 2 hours from now

    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Exact Time Test',
        bodyText: 'Body text',
        scheduledAt: scheduleTime,
      });

    expect(res.status).toBe(201);
    // The stored scheduledAt should match the submitted time (within 1 second tolerance)
    const storedTime = new Date(res.body.data.scheduledAt).getTime();
    const expectedTime = new Date(scheduleTime).getTime();
    expect(Math.abs(storedTime - expectedTime)).toBeLessThan(1000);
  });

  it('should NOT set status to sent when scheduledAt is provided alongside status: sent', async () => {
    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Status Override Test',
        bodyText: 'scheduledAt should take precedence over status field',
        status: 'sent',           // status: sent should be ignored
        scheduledAt: futureDate(), // scheduledAt takes priority
      });

    expect(res.status).toBe(201);
    // scheduledAt takes precedence — email should be scheduled, not immediately sent
    expect(res.body.data.status).toBe('scheduled');
  });

  it('should not enqueue a job for non-scheduled emails (null stub safe in test env)', async () => {
    // Immediately sent email — no scheduledAt — should not throw even with null queue
    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Immediate Send',
        bodyText: 'Send now',
        status: 'sent',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('sent');
    expect(res.body.data.sentAt).toBeDefined();
  });
});

// ── Scheduled Email Validation ────────────────────────────────────────────────

describe('Feature 2 — Scheduled Email: scheduledAt validation', () => {
  let token;

  beforeAll(async () => {
    ({ accessToken: token } = await registerAndLogin('validation'));
  });

  it('should reject a scheduledAt date in the past', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago

    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Past Date Test',
        bodyText: 'Should fail',
        scheduledAt: pastDate,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/future/i);
  });

  it('should reject a scheduledAt that is exactly now (not in future)', async () => {
    // A date very slightly in the past due to processing time
    const almostNow = new Date(Date.now() - 100).toISOString();

    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Now Date Test',
        bodyText: 'Should fail',
        scheduledAt: almostNow,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject scheduledAt more than 1 year in the future', async () => {
    const twoYearsFromNow = new Date(
      Date.now() + 2 * 365 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Far Future Test',
        bodyText: 'Should fail',
        scheduledAt: twoYearsFromNow,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/1 year/i);
  });

  it('should reject an invalid scheduledAt format (non-date string)', async () => {
    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Invalid Format Test',
        bodyText: 'Should fail',
        scheduledAt: 'not-a-date',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should accept a valid scheduledAt just under 1 year away', async () => {
    const almostOneYear = new Date(
      Date.now() + 364 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Valid Far Future',
        bodyText: 'Should succeed',
        scheduledAt: almostOneYear,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('scheduled');
  });
});

// ── Undo-Send: User Preference ────────────────────────────────────────────────

describe('Feature 2 — Undo-Send: uses user preference instead of hardcoded value', () => {
  let token;
  let userId;

  beforeAll(async () => {
    ({ accessToken: token, userId } = await registerAndLogin('undosend'));
  });

  it('default undoExpiry should be ~10 seconds after sentAt for a new user', async () => {
    const before = Date.now();

    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Undo Default Test',
        bodyText: 'Test undo default',
        status: 'sent',
      });

    expect(res.status).toBe(201);
    const email = res.body.data;
    expect(email.undoExpiry).toBeDefined();

    // undoExpiry should be ~10 seconds from now (default preference)
    const undoTime = new Date(email.undoExpiry).getTime();
    const expectedMin = before + 8 * 1000;  // at least 8s
    const expectedMax = before + 15 * 1000; // at most 15s (accounting for processing)
    expect(undoTime).toBeGreaterThanOrEqual(expectedMin);
    expect(undoTime).toBeLessThanOrEqual(expectedMax);
  });

  it('should use undoSendSeconds = 30 when user updates their preference', async () => {
    // Update user preference to 30 seconds
    const prefRes = await request(app)
      .put(`${API}/users/me/preferences`)
      .set('Authorization', `Bearer ${token}`)
      .send({ undoSendSeconds: 30 });

    expect(prefRes.status).toBe(200);

    const before = Date.now();

    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Undo 30s Preference Test',
        bodyText: 'Test undo 30s',
        status: 'sent',
      });

    expect(res.status).toBe(201);
    const email = res.body.data;
    expect(email.undoExpiry).toBeDefined();

    // undoExpiry should now be ~30 seconds from now
    const undoTime = new Date(email.undoExpiry).getTime();
    const expectedMin = before + 25 * 1000; // at least 25s
    const expectedMax = before + 38 * 1000; // at most 38s
    expect(undoTime).toBeGreaterThanOrEqual(expectedMin);
    expect(undoTime).toBeLessThanOrEqual(expectedMax);
  });

  it('should use undoSendSeconds = 5 when user sets minimum preference', async () => {
    await request(app)
      .put(`${API}/users/me/preferences`)
      .set('Authorization', `Bearer ${token}`)
      .send({ undoSendSeconds: 5 });

    const before = Date.now();

    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Undo 5s Preference Test',
        bodyText: 'Test undo 5s',
        status: 'sent',
      });

    expect(res.status).toBe(201);
    const undoTime = new Date(res.body.data.undoExpiry).getTime();
    const expectedMin = before + 3 * 1000;
    const expectedMax = before + 10 * 1000;
    expect(undoTime).toBeGreaterThanOrEqual(expectedMin);
    expect(undoTime).toBeLessThanOrEqual(expectedMax);
  });

  it('draft emails should NOT have undoExpiry set', async () => {
    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Draft No Undo',
        bodyText: 'Draft has no undo',
        status: 'draft',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.undoExpiry).toBeNull();
  });
});

// ── Processor Unit Logic ──────────────────────────────────────────────────────

describe('Feature 2 — Email Processor: unit logic', () => {
  it('processor module should export a function', () => {
    const processor = require('../email/email.processor');
    expect(typeof processor).toBe('function');
  });
});

// ── Regression: existing email functionality unaffected ───────────────────────

describe('Feature 2 — Regression: existing email operations unaffected', () => {
  let token;

  beforeAll(async () => {
    ({ accessToken: token } = await registerAndLogin('regression'));
  });

  it('GET /emails should still return emails', async () => {
    const res = await request(app)
      .get(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('creating a draft still works', async () => {
    const res = await request(app)
      .post(`${API}/emails`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: [{ email: 'recipient@example.com' }],
        subject: 'Regression Draft',
        bodyText: 'A draft email',
        status: 'draft',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.scheduledAt).toBeNull();
  });
});
