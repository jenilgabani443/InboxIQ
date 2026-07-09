'use strict';

const mongoose = require('mongoose');

/**
 * SavedSearch Model — Phase 4
 *
 * Allows users to persist frequently-used search queries with a friendly name.
 *
 * Ownership is enforced at the service layer — users may only access their own
 * saved searches. The `{ userId, name }` unique index prevents duplicate names
 * per user while allowing different users to use the same name.
 */
const savedSearchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    query: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true, // provides createdAt + updatedAt automatically
    toJSON: { virtuals: false },
    toObject: { virtuals: false },
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────────

// Primary listing index — efficient per-user retrieval, newest first
savedSearchSchema.index({ userId: 1, createdAt: -1 });

// Prevent duplicate names per user
savedSearchSchema.index({ userId: 1, name: 1 }, { unique: true });

const SavedSearch = mongoose.model('SavedSearch', savedSearchSchema);

module.exports = SavedSearch;
