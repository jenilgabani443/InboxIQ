'use strict';

const mongoose = require('mongoose');
const SearchHistory = require('./search.model');
const SavedSearch = require('./savedSearch.model');
const ApiError = require('../../shared/utils/apiError');

/**
 * SearchService — Phase 4
 *
 * Business logic for:
 *  - Search history (Feature 3): add, list, clear
 *  - Saved searches (Feature 4): create, list, update, delete
 *
 * All methods are scoped to the authenticated userId to prevent
 * cross-user data access at the service layer.
 */

const HISTORY_LIMIT = 20;

// ── Search History ─────────────────────────────────────────────────────────────

/**
 * Add a query to the user's search history.
 *
 * Behaviour:
 *  1. Upsert: if the same query already exists, only searchedAt is updated
 *     (dedup — moves existing entry to top).
 *  2. Cap: after upsert, if total entries exceed HISTORY_LIMIT, the oldest
 *     entries are removed so the cap is enforced.
 *
 * This is a best-effort operation — errors are non-fatal for the search caller.
 *
 * @param {string} userId
 * @param {string} query  - raw query string submitted by the user
 */
const addToHistory = async (userId, query) => {
  if (!query || !query.trim()) return;

  const normalised = query.trim();

  // Upsert: update searchedAt if exists, insert if not
  await SearchHistory.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(userId), query: normalised },
    { $set: { searchedAt: new Date() } },
    { upsert: true, new: true },
  );

  // Enforce the 20-entry cap.
  // Find entries beyond position 20, then delete them.
  const entries = await SearchHistory.find({ userId })
    .sort({ searchedAt: -1 })
    .skip(HISTORY_LIMIT)
    .select('_id')
    .lean();

  if (entries.length > 0) {
    const idsToDelete = entries.map((e) => e._id);
    await SearchHistory.deleteMany({ _id: { $in: idsToDelete } });
  }
};

/**
 * Return up to HISTORY_LIMIT most-recent search history entries for a user.
 *
 * @param {string} userId
 * @returns {object[]}
 */
const getHistory = async (userId) => SearchHistory.find({ userId: new mongoose.Types.ObjectId(userId) })
    .sort({ searchedAt: -1 })
    .limit(HISTORY_LIMIT)
    .select('query searchedAt -_id')
    .lean();

/**
 * Delete all search history entries for a user.
 *
 * @param {string} userId
 * @returns {{ deletedCount: number }}
 */
const clearHistory = async (userId) => {
  const result = await SearchHistory.deleteMany({
    userId: new mongoose.Types.ObjectId(userId),
  });
  return { deletedCount: result.deletedCount };
};

// ── Saved Searches ─────────────────────────────────────────────────────────────

/**
 * Create a new saved search.
 *
 * Throws 409 if the user already has a saved search with the same name.
 *
 * @param {string} userId
 * @param {{ name: string, query: string }} data
 * @returns {object} created SavedSearch document
 */
const createSavedSearch = async (userId, { name, query }) => {
  // Check for duplicate name before hitting the unique index
  // so we return a clean 409 instead of a raw Mongo duplicate-key error.
  const existing = await SavedSearch.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    name,
  }).lean();

  if (existing) {
    throw ApiError.conflict(`A saved search named "${name}" already exists`);
  }

  const saved = await SavedSearch.create({
    userId: new mongoose.Types.ObjectId(userId),
    name,
    query,
  });

  return saved;
};

/**
 * List all saved searches for a user, newest first.
 *
 * @param {string} userId
 * @returns {object[]}
 */
const getSavedSearches = async (userId) => SavedSearch.find({ userId: new mongoose.Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .lean();

/**
 * Update name and/or query of a saved search.
 *
 * Ownership is enforced — only the owning user can update.
 * Throws 404 if not found, 409 if the new name conflicts with another entry.
 *
 * @param {string} userId
 * @param {string} id    - SavedSearch ObjectId string
 * @param {{ name?: string, query?: string }} updates
 * @returns {object} updated document
 */
const updateSavedSearch = async (userId, id, updates) => {
  // If renaming, check the new name is not already taken by another entry
  if (updates.name) {
    const conflict = await SavedSearch.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      name: updates.name,
      _id: { $ne: new mongoose.Types.ObjectId(id) },
    }).lean();

    if (conflict) {
      throw ApiError.conflict(`A saved search named "${updates.name}" already exists`);
    }
  }

  const saved = await SavedSearch.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(userId),
    },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!saved) {
    throw ApiError.notFound('Saved search not found');
  }

  return saved;
};

/**
 * Delete a saved search.
 *
 * Ownership is enforced — only the owning user can delete.
 * Throws 404 if not found.
 *
 * @param {string} userId
 * @param {string} id  - SavedSearch ObjectId string
 */
const deleteSavedSearch = async (userId, id) => {
  const result = await SavedSearch.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(id),
    userId: new mongoose.Types.ObjectId(userId),
  });

  if (!result) {
    throw ApiError.notFound('Saved search not found');
  }
};

module.exports = {
  // History
  addToHistory,
  getHistory,
  clearHistory,
  // Saved searches
  createSavedSearch,
  getSavedSearches,
  updateSavedSearch,
  deleteSavedSearch,
};
