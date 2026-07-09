'use strict';

const { z } = require('zod');

// ── Search History Schemas ─────────────────────────────────────────────────────

/**
 * GET /search/history — no query parameters required.
 * Schema defined for forward-compatibility and consistency.
 */
const getHistorySchema = z.object({});

/**
 * DELETE /search/history — no body or params required.
 */
const deleteHistorySchema = z.object({});

// ── Saved Search Schemas (Feature 4) ──────────────────────────────────────────

/**
 * POST /search/saved
 */
const createSavedSearchSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(100, 'Name cannot exceed 100 characters'),
    query: z
      .string()
      .trim()
      .min(1, 'Query is required')
      .max(500, 'Query cannot exceed 500 characters'),
  }),
});

/**
 * PATCH /search/saved/:id
 */
const updateSavedSearchSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Saved search ID is required'),
  }),
  body: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      query: z.string().trim().min(1).max(500).optional(),
    })
    .refine((data) => data.name !== undefined || data.query !== undefined, {
      message: 'At least one of name or query must be provided',
    }),
});

/**
 * DELETE /search/saved/:id
 */
const deleteSavedSearchSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Saved search ID is required'),
  }),
});

module.exports = {
  getHistorySchema,
  deleteHistorySchema,
  createSavedSearchSchema,
  updateSavedSearchSchema,
  deleteSavedSearchSchema,
};
