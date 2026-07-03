'use strict';

/**
 * Email Job Processor — Phase 5 (Feature 2)
 *
 * Processes 'send_scheduled_email' jobs from the emailQueue.
 *
 * Job payload:
 *   { emailId: string, userId: string }
 *
 * Processing steps:
 *  1. Fetch the email from DB (re-fetch — never trust job payload for current state)
 *  2. Verify it is still in 'scheduled' status and not soft-deleted
 *  3. Update status → 'sent', folder → 'sent', sentAt → now
 *  4. Emit Socket.IO EMAIL_UPDATED event to the sender
 *  5. Emit NEW_EMAIL event to each recipient (best-effort)
 *
 * Safety guarantees:
 *  - Idempotent: if the email was already sent (e.g. duplicate job), the processor
 *    exits cleanly without making DB writes.
 *  - Deleted email: if the user deleted the email before delivery, the processor skips.
 *  - Ownership: emailId is re-fetched against userId for verification.
 */

const Email = require('./email.model');
const { EMAIL_STATUS, EMAIL_FOLDER } = require('../../shared/constants/emailStatus');
const EVENTS = require('../../shared/constants/events');
const logger = require('../../shared/utils/logger');

/**
 * Bull job processor function.
 * Bull calls this with the job object; must return a resolved Promise on success
 * or throw/reject on failure (triggers Bull retry logic).
 *
 * @param {import('bull').Job} job
 * @returns {Promise<void>}
 */
const processScheduledEmail = async (job) => {
  const { emailId, userId } = job.data;

  logger.info('[EmailProcessor] Processing scheduled email job', {
    jobId: job.id,
    emailId,
    userId,
  });

  // 1. Fetch the email — verify it exists and belongs to the user
  const email = await Email.findOne({ _id: emailId, 'from.userId': userId });

  if (!email) {
    // Email was deleted before the scheduled time — skip silently
    logger.warn('[EmailProcessor] Email not found or deleted, skipping', { emailId, userId });
    return;
  }

  // 2. Verify it is still scheduled (guard against duplicate job execution)
  if (email.status !== EMAIL_STATUS.SCHEDULED) {
    logger.warn('[EmailProcessor] Email is no longer scheduled, skipping', {
      emailId,
      currentStatus: email.status,
    });
    return;
  }

  // 3. Transition: scheduled → sent
  email.status = EMAIL_STATUS.SENT;
  email.folder = EMAIL_FOLDER.SENT;
  email.sentAt = new Date();
  email.scheduledAt = null;

  await email.save();

  logger.info('[EmailProcessor] Scheduled email delivered successfully', { emailId });

  // 4. Emit real-time events via Socket.IO (best-effort — non-fatal if Socket.IO unavailable)
  try {
    const { emitToUser } = require('../../config/socket');

    // Notify the sender that their scheduled email was sent
    emitToUser(userId, EVENTS.EMAIL_UPDATED, {
      emailId: email._id,
      status: email.status,
      folder: email.folder,
      sentAt: email.sentAt,
    });

    // Notify each recipient
    if (email.to && email.to.length > 0) {
      email.to.forEach(({ email: recipientEmail }) => {
        emitToUser(recipientEmail, EVENTS.NEW_EMAIL, {
          emailId: email._id,
          from: email.from,
          subject: email.subject,
          snippet: email.snippet,
          sentAt: email.sentAt,
        });
      });
    }
  } catch (socketErr) {
    // Socket.IO errors must not fail the job — delivery is already complete
    logger.warn('[EmailProcessor] Socket emit failed (non-fatal)', {
      emailId,
      error: socketErr.message,
    });
  }
};

module.exports = processScheduledEmail;
