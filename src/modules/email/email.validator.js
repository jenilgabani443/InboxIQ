'use strict';

const { z } = require('zod');

// ── Reusable field helpers ─────────────────────────────────────────────────────

/** Coerce string "true"/"false" from query params to boolean */
const booleanString = z
  .string()
  .toLowerCase()
  .refine((v) => v === 'true' || v === 'false', { message: 'Must be "true" or "false"' })
  .transform((v) => v === 'true')
  .optional();

/** Validate YYYY-MM-DD date strings from query params */
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date in YYYY-MM-DD format')
  .optional();

// ── Email Search Schema ────────────────────────────────────────────────────────

/**
 * Validates GET /emails/search query parameters.
 *
 * At least one filter must be present (enforced in the route handler
 * rather than here to keep schema reusable).
 */
const searchEmailsSchema = z.object({
  query: z
    .object({
      // Raw query string — may contain Gmail operators
      q: z.string().trim().max(500, 'Query too long').optional(),

      // Explicit per-field filters (override parsed operators)
      from: z.string().trim().max(254).optional(),
      to: z.string().trim().max(254).optional(),
      cc: z.string().trim().max(254).optional(),
      bcc: z.string().trim().max(254).optional(),
      subject: z.string().trim().max(500).optional(),

      // Label ID (ObjectId string)
      label: z.string().trim().optional(),

      // Attachment filename substring
      attachmentName: z.string().trim().max(255).optional(),

      // Folder filter
      folder: z
        .enum(['inbox', 'sent', 'drafts', 'trash', 'spam', 'archive'], {
          errorMap: () => ({ message: 'Invalid folder. Must be one of: inbox, sent, drafts, trash, spam, archive' }),
        })
        .optional(),

      // Boolean flags — arrive as strings from query params
      hasAttachment: booleanString,
      isRead: booleanString,

      // Date range
      before: dateString,
      after: dateString,

      // Sorting
      sortBy: z
        .enum(['createdAt', 'sentAt', 'subject', 'priorityScore'], {
          errorMap: () => ({
            message: 'sortBy must be one of: createdAt, sentAt, subject, priorityScore',
          }),
        })
        .default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),

      // Pagination
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    })
    .refine(
      (data) => {
        // At least one meaningful filter must be provided
        const hasFilter =
          data.q ||
          data.from ||
          data.to ||
          data.cc ||
          data.bcc ||
          data.subject ||
          data.label ||
          data.attachmentName ||
          data.folder ||
          data.hasAttachment !== undefined ||
          data.isRead !== undefined ||
          data.before ||
          data.after;
        return !!hasFilter;
      },
      { message: 'At least one search filter is required' },
    ),
});

// ── Bulk Operations Schema ─────────────────────────────────────────────────────

const bulkOperationsSchema = z.object({
  body: z.object({
    emailIds: z.array(z.string()).min(1, 'At least one email ID is required'),
    operation: z.enum(
      ['markRead', 'markUnread', 'archive', 'trash', 'restore', 'applyLabels', 'removeLabels'],
      { errorMap: () => ({ message: 'Invalid operation' }) }
    ),
    labels: z.array(z.string()).optional(),
  }).refine(
    (data) => {
      if ((data.operation === 'applyLabels' || data.operation === 'removeLabels') && (!data.labels || data.labels.length === 0)) {
        return false;
      }
      return true;
    },
    { message: 'Labels array is required for label operations', path: ['labels'] }
  ),
});

module.exports = { searchEmailsSchema, bulkOperationsSchema };
