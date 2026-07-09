'use strict';

const mongoose = require('mongoose');

/**
 * SearchHistory Model — Phase 4
 *
 * Tracks recent searches per user.
 *
 * Rules (enforced in the service layer):
 *  - Maximum 20 entries per user
 *  - No duplicate queries (unique index on { userId, query })
 *  - Existing query moves to top by updating searchedAt
 */
const searchHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Raw query string as submitted by the user (may contain operators)
    query: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    searchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Disable auto createdAt/updatedAt — we manage searchedAt manually
    timestamps: false,
    // Lean-friendly virtuals not needed here
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────────

// Unique constraint ensures no duplicate queries per user.
// The service performs an upsert on this pair.
searchHistorySchema.index({ userId: 1, query: 1 }, { unique: true });

// Ordered listing — most recent first, capped at 20
searchHistorySchema.index({ userId: 1, searchedAt: -1 });

const SearchHistory = mongoose.model('SearchHistory', searchHistorySchema);

module.exports = SearchHistory;
