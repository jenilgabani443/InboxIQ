'use strict';

/**
 * Job Worker Bootstrap — Phase 5
 *
 * Registers all Bull queue processors and starts consuming jobs.
 * Called once during application startup (after DB + Redis are connected).
 *
 * Each processor is registered with its queue here.
 * The actual processing logic lives in dedicated processor files
 * co-located with the feature module (e.g., email.processor.js).
 *
 * Processors are loaded lazily (via require inside the function) so
 * that this file can be imported safely even before the processors exist.
 *
 * Usage (in server.js):
 *   const { startWorkers } = require('./modules/jobs/job.worker');
 *   startWorkers();
 */

const env = require('../../config/env');
const logger = require('../../shared/utils/logger');

/**
 * Starts all queue workers.
 * No-op in test environment (queues are null stubs).
 */
const startWorkers = () => {
  if (env.NODE_ENV === 'test') {
    logger.debug('[Workers] Skipping worker registration in test environment');
    return;
  }

  const { emailQueue, snoozeQueue, filterQueue } = require('../../config/queue');

  // ── Email Queue Processor ─────────────────────────────────────────────────
  // Feature 2: Scheduled Email Delivery
  emailQueue.process('send_scheduled_email', require('../email/email.processor'));

  // ── Snooze Queue Processor ────────────────────────────────────────────────
  // Feature 3: Snooze Background Job
  snoozeQueue.process('process_snooze', require('../email/snooze.processor'));

  // ── Filter Queue Processor ────────────────────────────────────────────────
  // Feature 4: Auto-Apply Email Filters
  filterQueue.process('apply_filters', require('../filter/filter.processor'));

  logger.info('[Workers] Bull queue workers started');

  // Log queue names for observability (useful for Redis Commander inspection)
  [emailQueue, snoozeQueue, filterQueue].forEach((q) => {
    logger.info(`[Workers] Listening on queue: ${q.name}`);
  });
};

module.exports = { startWorkers };
