'use strict';

/**
 * Socket.IO event name constants.
 * Using constants prevents typos in event names across emitter and listener code.
 */
const EVENTS = Object.freeze({
  // Email events
  NEW_EMAIL: 'email:new',
  EMAIL_READ: 'email:read',
  EMAIL_DELETED: 'email:deleted',
  EMAIL_UPDATED: 'email:updated',

  // Thread events
  THREAD_UPDATED: 'thread:updated',
  THREAD_NOTE_ADDED: 'thread:note_added',
  THREAD_ASSIGNED: 'thread:assigned',
  THREAD_STATUS_CHANGED: 'thread:status_changed',

  // Collaboration events
  JOIN_THREAD: 'thread:join',
  LEAVE_THREAD: 'thread:leave',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',

  // Notification events
  NOTIFICATION: 'notification:new',

  // System events
  SNOOZE_DUE: 'snooze:due',
});

module.exports = EVENTS;
