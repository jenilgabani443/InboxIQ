'use strict';

const mongoose = require('mongoose');

const AUDIT_ACTIONS = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'PASSWORD_CHANGED',
  'EMAIL_SENT',
  'EMAIL_UPDATED',
  'EMAIL_DELETED',
  'EMAIL_ARCHIVED',
  'EMAIL_SNOOZED',
  'LABEL_CREATED',
  'LABEL_UPDATED',
  'LABEL_DELETED',
  'NOTE_CREATED',
  'NOTE_DELETED',
  'THREAD_ASSIGNED',
  'THREAD_STATUS_CHANGED',
  'AI_PRIORITY_CALCULATED',
  'AI_AUTO_LABEL',
  'AI_SUMMARY_GENERATED',
  'MFA_ENABLED',
  'MFA_DISABLED'
];

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      enum: AUDIT_ACTIONS,
      index: true
    },
    resourceType: {
      type: String,
      required: false,
    },
    resourceId: {
      type: String,
      required: false,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ip: {
      type: String,
      required: false
    },
    userAgent: {
      type: String,
      required: false
    },
    createdAt: {
      type: Date,
      default: Date.now,
      // 90 days TTL index. MongoDB will automatically delete documents older than 90 days.
      expires: '90d'
    }
  },
  {
    // We only need createdAt, but timestamps gives both. We can just set timestamps: false
    // and manually define createdAt (which we did above).
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Ensure a standard index on createdAt for sorting (in addition to the TTL index)
// Note: Mongoose `expires` automatically creates an index. 
// Adding another explicit `{ createdAt: -1 }` index helps with sorting newest first.
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = {
  AuditLog,
  AUDIT_ACTIONS
};
