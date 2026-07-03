'use strict';

const mongoose = require('mongoose');
const Email = require('./email.model');
const { paginate } = require('../../shared/utils/pagination');
const { parseSearchQuery } = require('../search/search.parser');

/**
 * Email Service — Phase 4
 *
 * Houses business logic for email operations.
 * Controllers / route handlers stay thin and delegate here.
 */

/**
 * Build a MongoDB filter document from structured search parameters.
 * All results are scoped to the authenticated user via `from.userId`.
 *
 * @param {string} userId
 * @param {object} filters
 * @returns {object} MongoDB query filter
 */
const buildEmailQuery = (userId, filters) => {
  const {
    textQuery,
    from: fromEmail,
    to: toEmail,
    cc: ccEmail,
    bcc: bccEmail,
    subject: subjectFilter,
    label,
    hasAttachment,
    isRead,
    folder,
    before,
    after,
  } = filters;

  // Base: always scope to the authenticated user
  const query = { 'from.userId': new mongoose.Types.ObjectId(userId) };

  // ── Full-text search ────────────────────────────────────────────────────────
  if (textQuery) {
    query.$text = { $search: textQuery };
  }

  // ── Per-field filters ───────────────────────────────────────────────────────
  if (fromEmail) query['from.email'] = { $regex: fromEmail, $options: 'i' };
  if (toEmail) query['to.email'] = { $regex: toEmail, $options: 'i' };
  if (ccEmail) query['cc.email'] = { $regex: ccEmail, $options: 'i' };
  if (bccEmail) query['bcc.email'] = { $regex: bccEmail, $options: 'i' };
  if (subjectFilter) query.subject = { $regex: subjectFilter, $options: 'i' };
  if (label) query.labels = label;
  if (folder) query.folder = folder;

  // ── Boolean flags ───────────────────────────────────────────────────────────
  if (hasAttachment === true) query.attachments = { $not: { $size: 0 } };
  if (isRead === true) query.isRead = true;
  if (isRead === false) query.isRead = false;

  // ── Date range ──────────────────────────────────────────────────────────────
  if (before || after) {
    query.createdAt = {};
    if (before) query.createdAt.$lte = new Date(before);
    if (after) query.createdAt.$gte = new Date(after);
  }

  return query;
};

/**
 * Search emails with optional attachment-filename filter.
 *
 * When `attachmentName` is provided the service falls back to an aggregation
 * pipeline that $lookup-joins the Attachment collection, avoiding any schema
 * denormalisation on the Email document.
 *
 * @param {string}  userId
 * @param {object}  rawFilters   - parsed or raw query parameters
 * @param {object}  pagination   - { page, limit, sortBy, sortOrder }
 * @returns {{ results: object[], meta: object }}
 */
const searchEmails = async (userId, rawFilters, { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = {}) => {
  // If the caller passed a raw `q` string that may contain operators, parse it
  const parsed = rawFilters.q ? parseSearchQuery(rawFilters.q) : {};

  // Merge parsed operators with explicitly provided filters
  // Explicit params take precedence over operator-parsed values
  const filters = {
    textQuery: parsed.textQuery || null,
    from: rawFilters.from || parsed.from || null,
    to: rawFilters.to || parsed.to || null,
    cc: rawFilters.cc || parsed.cc || null,
    bcc: rawFilters.bcc || parsed.bcc || null,
    subject: rawFilters.subject || parsed.subject || null,
    label: rawFilters.label || parsed.label || null,
    hasAttachment: rawFilters.hasAttachment !== undefined ? rawFilters.hasAttachment : parsed.hasAttachment,
    isRead: rawFilters.isRead !== undefined ? rawFilters.isRead : parsed.isRead,
    folder: rawFilters.folder || parsed.folder || null,
    before: rawFilters.before || parsed.before || null,
    after: rawFilters.after || parsed.after || null,
  };

  const attachmentName = rawFilters.attachmentName || null;
  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const ALLOWED_SORT_FIELDS = ['createdAt', 'sentAt', 'subject', 'priorityScore'];
  const safeSortBy = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';

  // ── Branch: attachment filename filter requires aggregation ─────────────────
  if (attachmentName) {
    return _searchWithAttachmentName(userId, filters, attachmentName, {
      page, limit, safeSortBy, sortDirection,
    });
  }

  // ── Standard find() path ────────────────────────────────────────────────────
  const query = buildEmailQuery(userId, filters);

  const total = await Email.countDocuments(query);
  const { skip, limit: lim, meta } = paginate({ page, limit, total });

  // When $text is used, we can add a relevance score sort
  const sortSpec = filters.textQuery
    ? { score: { $meta: 'textScore' }, [safeSortBy]: sortDirection }
    : { [safeSortBy]: sortDirection };

  const results = await Email.find(query, filters.textQuery ? { score: { $meta: 'textScore' } } : {})
    .sort(sortSpec)
    .skip(skip)
    .limit(lim)
    .select('-bodyHtml')
    .populate('attachments', 'filename sizeBytes mimeType')
    .populate('labels', 'name color')
    .lean();

  return { results, meta };
};

/**
 * Aggregation path: search emails filtered by attachment filename.
 * Uses $lookup to join the Attachment collection without schema changes.
 *
 * @private
 */
const _searchWithAttachmentName = async (userId, filters, attachmentName, { page, limit, safeSortBy, sortDirection }) => {
  const baseQuery = buildEmailQuery(userId, filters);

  const { skip, limit: lim } = paginate({ page, limit, total: 0 });

  const pipeline = [
    // 1. Apply base filters (scoping + text search)
    { $match: { ...baseQuery, isDeleted: false } },

    // 2. Join attachments
    {
      $lookup: {
        from: 'attachments',
        localField: 'attachments',
        foreignField: '_id',
        as: 'attachments',
      },
    },

    // 3. Filter by attachment filename
    {
      $match: {
        'attachments.filename': { $regex: attachmentName, $options: 'i' },
      },
    },

    // 4. Facet: count + paginated data in a single round-trip
    {
      $facet: {
        total: [{ $count: 'count' }],
        results: [
          { $sort: { [safeSortBy]: sortDirection } },
          { $skip: skip },
          { $limit: lim },
          { $project: { bodyHtml: 0 } },
        ],
      },
    },
  ];

  const [facet] = await Email.aggregate(pipeline);
  const total = facet?.total?.[0]?.count ?? 0;
  const { meta } = paginate({ page, limit, total });

  return { results: facet?.results ?? [], meta };
};

module.exports = { searchEmails };
