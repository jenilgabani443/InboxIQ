'use strict';

const mongoose = require('mongoose');
const { EMAIL_STATUS, EMAIL_FOLDER } = require('../../shared/constants/emailStatus');

/**
 * Email Schema
 *
 * An email is always part of a thread. Threads group emails by subject + references.
 * Key fields:
 * - bodyHtml: sanitized HTML (sanitize on input in the service layer)
 * - snippet: first 200 chars of bodyText (pre-computed for list views)
 * - priorityScore: AI-assigned 0–100 (higher = more important)
 * - undoExpiry: timestamp until which the send can be cancelled
 * - isDeleted + deletedAt: soft delete (permanent cleanup scheduled job after 30d)
 */
const emailAddressSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true },
    name: { type: String, default: '' },
  },
  { _id: false },
);

const emailSchema = new mongoose.Schema(
  {
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Thread',
      required: true,
      index: true,
    },
    // RFC 2822 threading
    messageId: { type: String, unique: true, sparse: true },
    inReplyTo: { type: String, default: null },
    references: { type: [String], default: [] },

    from: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      email: { type: String, required: true, lowercase: true },
      name: { type: String, default: '' },
    },
    to: { type: [emailAddressSchema], required: true },
    cc: { type: [emailAddressSchema], default: [] },
    bcc: { type: [emailAddressSchema], default: [] },

    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    bodyHtml: { type: String, default: '' },
    bodyText: { type: String, default: '' },
    snippet: {
      type: String,
      default: '',
      maxlength: 200,
    },

    attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' }],

    status: {
      type: String,
      enum: Object.values(EMAIL_STATUS),
      default: EMAIL_STATUS.DRAFT,
      index: true,
    },
    folder: {
      type: String,
      enum: Object.values(EMAIL_FOLDER),
      default: EMAIL_FOLDER.DRAFTS,
      index: true,
    },

    isRead: { type: Boolean, default: false },
    isStarred: { type: Boolean, default: false },
    isSnoozed: { type: Boolean, default: false },
    snoozeUntil: { type: Date },

    isReadReceiptRequested: { type: Boolean, default: false },
    readAt: { type: Date, default: null },

    labels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Label' }],

    priorityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },

    scheduledAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    undoExpiry: { type: Date, default: null },

    // Soft delete
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Compound Indexes ───────────────────────────────────────────────────────────
emailSchema.index({ 'from.userId': 1, folder: 1, createdAt: -1 });
emailSchema.index({ threadId: 1, createdAt: 1 });
emailSchema.index({ scheduledAt: 1 }, { sparse: true });
emailSchema.index({ snoozeUntil: 1 }, { sparse: true });
emailSchema.index({ isDeleted: 1, deletedAt: 1 });

// ── Pre-save: Auto-generate snippet ───────────────────────────────────────────
emailSchema.pre('save', function (next) {
  if (this.isModified('bodyText') && this.bodyText) {
    this.snippet = this.bodyText.slice(0, 200).replace(/\s+/g, ' ').trim();
  }
  next();
});

// ── Query middleware: exclude soft-deleted ─────────────────────────────────────
emailSchema.pre(/^find/, function (next) {
  if (this.getQuery().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});

const Email = mongoose.model('Email', emailSchema);

module.exports = Email;
