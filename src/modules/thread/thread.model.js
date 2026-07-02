'use strict';

const mongoose = require('mongoose');
const { THREAD_STATUS } = require('../../shared/constants/emailStatus');

/**
 * Thread Schema
 *
 * A thread groups emails by shared subject + reference chain.
 * Participants, last activity, and collaboration data are maintained here
 * to support efficient list queries without loading all emails.
 *
 * Internal notes are embedded — they are NOT visible in outgoing emails.
 */
const internalNoteSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 10000 },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const threadSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    emailIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Email' }],
    lastEmailAt: { type: Date, default: Date.now, index: true },
    messageCount: { type: Number, default: 0 },

    // Collaboration
    status: {
      type: String,
      enum: Object.values(THREAD_STATUS),
      default: THREAD_STATUS.OPEN,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    internalNotes: {
      type: [internalNoteSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────────
threadSchema.index({ participants: 1, lastEmailAt: -1 });
threadSchema.index({ status: 1 });

const Thread = mongoose.model('Thread', threadSchema);

module.exports = Thread;
