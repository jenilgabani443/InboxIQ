'use strict';

const EMAIL_STATUS = Object.freeze({
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  SENT: 'sent',
  FAILED: 'failed',
});

const EMAIL_FOLDER = Object.freeze({
  INBOX: 'inbox',
  SENT: 'sent',
  DRAFTS: 'drafts',
  TRASH: 'trash',
  SPAM: 'spam',
  ARCHIVE: 'archive',
});

const THREAD_STATUS = Object.freeze({
  OPEN: 'open',
  PENDING: 'pending',
  RESOLVED: 'resolved',
});

const NOTIFICATION_TYPE = Object.freeze({
  NEW_EMAIL: 'new_email',
  MENTION: 'mention',
  ASSIGNMENT: 'assignment',
  SNOOZE_DUE: 'snooze_due',
  READ_RECEIPT: 'read_receipt',
});

module.exports = { EMAIL_STATUS, EMAIL_FOLDER, THREAD_STATUS, NOTIFICATION_TYPE };
