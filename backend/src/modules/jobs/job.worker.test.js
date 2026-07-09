'use strict';

/**
 * Feature 1 — Bull Queue Infrastructure Tests
 *
 * Tests the queue module's public interface and verifies that the
 * application boots and runs normally with queue infrastructure in place.
 *
 * In tests, NODE_ENV=test so all queues are null stubs — we test:
 *  1. Queue module exports the expected shape
 *  2. Null-stub methods are callable without errors (safe no-ops)
 *  3. The application starts correctly with workers registered
 *  4. Existing API endpoints are unaffected by the queue integration
 *
 * Note: Real Bull queue behaviour (job enqueue + processing) is verified
 * manually against the running Docker environment.
 */

const request = require('supertest');
const createApp = require('../../app');

let app;

beforeAll(() => {
  app = createApp();
});

// ── Queue module shape tests ───────────────────────────────────────────────────

describe('Queue Infrastructure — Module Exports', () => {
  it('should export the expected named queues', () => {
    const queue = require('../../config/queue');

    expect(queue).toHaveProperty('emailQueue');
    expect(queue).toHaveProperty('snoozeQueue');
    expect(queue).toHaveProperty('filterQueue');
    expect(queue).toHaveProperty('closeQueues');
  });

  it('emailQueue should expose an add() method (null stub in test env)', async () => {
    const { emailQueue } = require('../../config/queue');

    expect(typeof emailQueue.add).toBe('function');
    // Should resolve without error (null stub returns null)
    const result = await emailQueue.add('test_job', { foo: 'bar' }, { delay: 1000 });
    expect(result).toBeNull();
  });

  it('snoozeQueue should expose an add() method (null stub in test env)', async () => {
    const { snoozeQueue } = require('../../config/queue');

    expect(typeof snoozeQueue.add).toBe('function');
    const result = await snoozeQueue.add('process_snooze', { emailId: 'abc', userId: 'xyz' });
    expect(result).toBeNull();
  });

  it('filterQueue should expose an add() method (null stub in test env)', async () => {
    const { filterQueue } = require('../../config/queue');

    expect(typeof filterQueue.add).toBe('function');
    const result = await filterQueue.add('apply_filters', { emailId: 'abc', userId: 'xyz' });
    expect(result).toBeNull();
  });

  it('closeQueues() should resolve without error in test env', async () => {
    const { closeQueues } = require('../../config/queue');

    await expect(closeQueues()).resolves.toBeUndefined();
  });
});

// ── Worker bootstrap tests ────────────────────────────────────────────────────

describe('Queue Infrastructure — Worker Bootstrap', () => {
  it('startWorkers() should be a function and not throw in test env', () => {
    const { startWorkers } = require('../jobs/job.worker');

    expect(typeof startWorkers).toBe('function');
    expect(() => startWorkers()).not.toThrow();
  });
});

// ── Application health — queues do not break existing routes ──────────────────

describe('Queue Infrastructure — Application Health', () => {
  it('GET /api/v1/health should return 200 with queue infrastructure present', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('UP');
  });

  it('POST /api/v1/auth/register should still work normally', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'queue_test@inboxiq.app',
      password: 'Test@1234!',
      displayName: 'Queue Test User',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('existing protected routes should still require authentication', async () => {
    const res = await request(app).get('/api/v1/users/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
