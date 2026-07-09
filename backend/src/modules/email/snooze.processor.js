'use strict';

/**
 * Snooze Job Processor — Phase 5 (Feature 3)
 *
 * Processes 'process_snooze' jobs from the snoozeQueue.
 *
 * Job payload:
 *   { emailId: string, userId: string }
 *
 * Processing steps:
 *  1. Fetch the email from DB (re-fetch — never trust job payload for current state)
 *  2. Verify it is still snoozed and not soft-deleted
 *  3. Restore: isSnoozed → false, snoozeUntil → null, folder → inbox
 *  4. Create an in-app Notification document (type: 'snooze_due')
 *  5. Emit SNOOZE_DUE event to the user's private Socket.IO room
 *  6. Emit NOTIFICATION event with the new notification payload
 *
 * Safety guarantees:
 *  - Idempotent: if isSnoozed is already false (email was manually un-snoozed),
 *    the processor exits without writing to DB.
 *  - Deleted email: if the email was trashed/deleted before the snooze fires,
 *    the processor skips silently.
 *  - Re-snooze: Bull jobId 'snooze:{emailId}' ensures only one active job
 *    per email exists at a time; re-snoozing replaces the waiting job.
 */

const Email = require('./email.model');
const Notification = require('../notification/notification.model');
const { EMAIL_FOLDER, NOTIFICATION_TYPE } = require('../../shared/constants/emailStatus');
const EVENTS = require('../../shared/constants/events');
const logger = require('../../shared/utils/logger');

/**
 * Bull job processor function.
 *
 * @param {import('bull').Job} job
 * @returns {Promise<void>}
 */
const processSnooze = async (job) => {
  const { emailId, userId } = job.data;

  logger.info('[SnoozeProcessor] Processing snooze expiry job', {
    jobId: job.id,
    emailId,
    userId,
  });

  // 1. Fetch the email — verify it exists and belongs to the user
  const email = await Email.findOne({ _id: emailId, 'from.userId': userId });

  if (!email) {
    // Email was deleted before the snooze fired — skip silently
    logger.warn('[SnoozeProcessor] Email not found or deleted, skipping', { emailId, userId });
    return;
  }

  // 2. Verify it is still snoozed (guard against duplicate job execution or manual un-snooze)
  if (!email.isSnoozed) {
    logger.warn('[SnoozeProcessor] Email is no longer snoozed, skipping', { emailId });
    return;
  }

  // 3. Restore to inbox
  email.isSnoozed = false;
  email.snoozeUntil = null;
  email.folder = EMAIL_FOLDER.INBOX;

  await email.save();

  logger.info('[SnoozeProcessor] Snooze expired — email restored to inbox', { emailId });

  // 4. Create an in-app notification
  let notification = null;
  try {
    notification = await Notification.create({
      userId,
      type: NOTIFICATION_TYPE.SNOOZE_DUE,
      referenceId: email._id,
      referenceModel: 'Email',
      message: `Snoozed email "${email.subject}" has returned to your inbox`,
    });
  } catch (notifErr) {
    // Non-fatal — the email is already restored; notification failure is logged only
    logger.warn('[SnoozeProcessor] Failed to create notification (non-fatal)', {
      emailId,
      error: notifErr.message,
    });
  }

  // 5. Emit Socket.IO events (best-effort — non-fatal if Socket.IO unavailable)
  try {
    const { emitToUser } = require('../../config/socket');

    // Notify the user that their snoozed email has returned
    emitToUser(userId, EVENTS.SNOOZE_DUE, {
      emailId: email._id,
      subject: email.subject,
      folder: email.folder,
    });

    // Emit the new notification so the client can display it immediately
    if (notification) {
      emitToUser(userId, EVENTS.NOTIFICATION, {
        notificationId: notification._id,
        type: notification.type,
        message: notification.message,
        referenceId: notification.referenceId,
        createdAt: notification.createdAt,
      });
    }
  } catch (socketErr) {
    // Socket.IO errors must not fail the job — restoration is already complete
    logger.warn('[SnoozeProcessor] Socket emit failed (non-fatal)', {
      emailId,
      error: socketErr.message,
    });
  }
};

module.exports = processSnooze;
