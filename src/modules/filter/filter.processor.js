'use strict';

/**
 * Filter Job Processor — Phase 5 (Feature 4)
 *
 * Processes 'apply_filters' jobs from the filterQueue.
 *
 * Job payload:
 *   { emailId: string, userId: string }
 *
 * Processing steps:
 *  1. Fetch the email from DB.
 *  2. Fetch all active filters for the user.
 *  3. Evaluate each filter's conditions (AND logic per filter).
 *  4. Apply actions (labels, markRead, star, archive, deleteEmail, forwardTo) if matched.
 *  5. Save the updated email and emit Socket.IO EVENT.EMAIL_UPDATED.
 */

const Email = require('../email/email.model');
const Filter = require('./filter.model');
const { EMAIL_FOLDER, EMAIL_STATUS } = require('../../shared/constants/emailStatus');
const EVENTS = require('../../shared/constants/events');
const logger = require('../../shared/utils/logger');
const { v4: uuidv4 } = require('uuid');

const processFilters = async (job) => {
  const { emailId, userId } = job.data;

  logger.info('[FilterProcessor] Evaluating filters for email', {
    jobId: job.id,
    emailId,
    userId,
  });

  const email = await Email.findOne({ _id: emailId, 'from.userId': userId });
  if (!email) {
    logger.warn('[FilterProcessor] Email not found, skipping', { emailId, userId });
    return;
  }

  const filters = await Filter.find({ userId, isActive: true });
  if (!filters || filters.length === 0) {
    return;
  }

  let updated = false;

  for (const filter of filters) {
    const { conditions, actions } = filter;
    let match = true;

    if (conditions.from && (!email.from.email || !email.from.email.toLowerCase().includes(conditions.from.toLowerCase()))) {
      match = false;
    }

    if (match && conditions.to) {
      const allRecipients = [...(email.to || []), ...(email.cc || []), ...(email.bcc || [])]
        .map((addr) => addr.email.toLowerCase());
      if (!allRecipients.some((addr) => addr.includes(conditions.to.toLowerCase()))) {
        match = false;
      }
    }

    if (match && conditions.subject) {
      if (!email.subject || !email.subject.toLowerCase().includes(conditions.subject.toLowerCase())) {
        match = false;
      }
    }

    if (match && conditions.hasAttachment !== null) {
      const hasAtt = email.attachments && email.attachments.length > 0;
      if (hasAtt !== conditions.hasAttachment) {
        match = false;
      }
    }

    if (match && conditions.bodyContains) {
      const lowerBodyContains = conditions.bodyContains.toLowerCase();
      const bodyTextMatch = email.bodyText && email.bodyText.toLowerCase().includes(lowerBodyContains);
      const bodyHtmlMatch = email.bodyHtml && email.bodyHtml.toLowerCase().includes(lowerBodyContains);
      if (!bodyTextMatch && !bodyHtmlMatch) {
        match = false;
      }
    }

    if (match) {
      logger.info(`[FilterProcessor] Filter "${filter.name}" matched email`, { emailId, filterId: filter._id });

      // Apply actions
      if (actions.applyLabel) {
        const hasLabel = email.labels.some((l) => l.toString() === actions.applyLabel.toString());
        if (!hasLabel) {
          email.labels.push(actions.applyLabel);
          updated = true;
        }
      }

      if (actions.markRead && !email.isRead) {
        email.isRead = true;
        email.readAt = new Date();
        updated = true;
      }

      if (actions.star && !email.isStarred) {
        email.isStarred = true;
        updated = true;
      }

      if (actions.deleteEmail && email.folder !== EMAIL_FOLDER.TRASH) {
        email.folder = EMAIL_FOLDER.TRASH;
        updated = true;
      } else if (actions.archive && email.folder !== EMAIL_FOLDER.ARCHIVE && email.folder !== EMAIL_FOLDER.TRASH) {
        email.folder = EMAIL_FOLDER.ARCHIVE;
        updated = true;
      }

      // Forward email if requested (simple forward via creating a new sent email)
      if (actions.forwardTo) {
        try {
          const forwardSubject = email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`;
          await Email.create({
            threadId: email.threadId,
            messageId: `<${uuidv4()}@inboxiq.app>`,
            from: email.from,
            to: [{ email: actions.forwardTo }],
            subject: forwardSubject,
            bodyText: `---------- Forwarded message ---------\nFrom: ${email.from.email}\nSubject: ${email.subject}\n\n${email.bodyText}`,
            bodyHtml: `<div><br>---------- Forwarded message ---------<br>From: ${email.from.email}<br>Subject: ${email.subject}<br><br>${email.bodyHtml}</div>`,
            status: EMAIL_STATUS.SENT,
            folder: EMAIL_FOLDER.SENT,
            sentAt: new Date(),
          });
          logger.info(`[FilterProcessor] Email forwarded to ${actions.forwardTo}`, { emailId });
        } catch (fwdErr) {
          logger.error(`[FilterProcessor] Failed to forward email to ${actions.forwardTo}`, { emailId, error: fwdErr.message });
        }
      }
    }
  }

  if (updated) {
    await email.save();
    logger.info('[FilterProcessor] Email updated by filters', { emailId });

    try {
      const { emitToUser } = require('../../config/socket');
      emitToUser(userId, EVENTS.EMAIL_UPDATED, {
        emailId: email._id,
        folder: email.folder,
        isRead: email.isRead,
        isStarred: email.isStarred,
        labels: email.labels,
      });
    } catch (err) {
      logger.warn('[FilterProcessor] Socket emit failed (non-fatal)', { error: err.message });
    }
  }
};

module.exports = processFilters;
