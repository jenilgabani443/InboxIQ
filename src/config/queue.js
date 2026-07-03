'use strict';

/**
 * Bull Queue Factory — Phase 5
 *
 * Provides named Bull queue singletons for all background job types.
 * Queues use the same Redis URL as the rest of the application.
 *
 * In test environments (NODE_ENV === 'test'), queues are not created because:
 * - ioredis-mock does not support the Lua scripting Bull relies on for atomic operations.
 * - Integration tests validate HTTP behavior; job scheduling is verified manually or with unit tests.
 *
 * Queue naming:
 *  - emailQueue   → scheduled email delivery
 *  - snoozeQueue  → snooze expiry restoration
 *  - filterQueue  → auto-apply email filters on email creation
 *
 * Usage:
 *   const { emailQueue } = require('../../config/queue');
 *   await emailQueue.add('send_scheduled_email', { emailId, userId }, { delay });
 */

const env = require('./env');
const logger = require('../shared/utils/logger');

// ── Null queue stub for test environment ──────────────────────────────────────
// Exposes the same interface callers use so no route code needs NODE_ENV checks.
const createNullQueue = (name) => ({
  name,
  add: async () => null,
  process: () => {},
  close: async () => {},
  on: () => {},
  removeJobs: async () => {},
});

// ── Real queue factory ────────────────────────────────────────────────────────
let Bull;
const isTest = env.NODE_ENV === 'test';

if (!isTest) {
  // Only require Bull in non-test environments to avoid ioredis-mock incompatibilities.
  Bull = require('bull');
}

/**
 * Creates a named Bull queue backed by Redis.
 *
 * @param {string} name - Queue name
 * @returns {import('bull').Queue | object} Bull queue instance or null-stub in test
 */
const createQueue = (name) => {
  if (isTest) {
    return createNullQueue(name);
  }

  const queue = new Bull(name, {
    redis: env.REDIS_URL,
    defaultJobOptions: {
      removeOnComplete: 20,   // Keep last 20 completed jobs for debugging
      removeOnFail: 50,       // Keep last 50 failed jobs for inspection
    },
  });

  queue.on('error', (err) => {
    logger.error(`[Queue:${name}] Error:`, { error: err.message });
  });

  queue.on('failed', (job, err) => {
    logger.error(`[Queue:${name}] Job ${job.id} failed:`, {
      jobData: job.data,
      error: err.message,
      attempts: job.attemptsMade,
    });
  });

  queue.on('completed', (job) => {
    logger.debug(`[Queue:${name}] Job ${job.id} completed`);
  });

  logger.info(`[Queue:${name}] Queue initialized`);
  return queue;
};

// ── Named queue singletons ────────────────────────────────────────────────────

/**
 * Email queue — handles scheduled email delivery jobs.
 * Job type: 'send_scheduled_email'
 */
const emailQueue = createQueue('email');

/**
 * Snooze queue — handles snooze expiry and inbox restoration jobs.
 * Job type: 'process_snooze'
 */
const snoozeQueue = createQueue('snooze');

/**
 * Filter queue — handles auto-applying email filter rules on new emails.
 * Job type: 'apply_filters'
 */
const filterQueue = createQueue('filter');

/**
 * Gracefully close all queues during application shutdown.
 * Waits for active jobs to complete before closing connections.
 *
 * @returns {Promise<void>}
 */
const closeQueues = async () => {
  if (isTest) return;
  await Promise.all([
    emailQueue.close(),
    snoozeQueue.close(),
    filterQueue.close(),
  ]);
  logger.info('All Bull queues closed');
};

module.exports = {
  emailQueue,
  snoozeQueue,
  filterQueue,
  closeQueues,
};
