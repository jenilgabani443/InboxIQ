'use strict';

const { z } = require('zod');

// ── Contact Autocomplete Schema ────────────────────────────────────────────────

/**
 * GET /contacts/autocomplete?q=
 *
 * q is required and must be at least 1 character.
 * Validation ensures we never hit MongoDB with an empty regex.
 */
const autocompleteSchema = z.object({
  query: z.object({
    q: z
      .string({ required_error: 'Search query q is required' })
      .trim()
      .min(1, 'Search query must be at least 1 character')
      .max(100, 'Search query cannot exceed 100 characters'),
  }),
});

// ── Contact Create Schema ──────────────────────────────────────────────────────

/**
 * POST /contacts
 */
const createContactSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Must be a valid email address')
      .toLowerCase()
      .trim(),
    name: z.string().trim().max(100, 'Name cannot exceed 100 characters').optional().default(''),
    avatarUrl: z.string().url('Must be a valid URL').optional().nullable(),
  }),
});

// ── Contact Update Schema ──────────────────────────────────────────────────────

/**
 * PATCH /contacts/:id
 */
const updateContactSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Contact ID is required'),
  }),
  body: z
    .object({
      name: z.string().trim().max(100).optional(),
      avatarUrl: z.string().url('Must be a valid URL').optional().nullable(),
    })
    .refine((data) => data.name !== undefined || data.avatarUrl !== undefined, {
      message: 'At least one of name or avatarUrl must be provided',
    }),
});

// ── Contact Delete Schema ──────────────────────────────────────────────────────

/**
 * DELETE /contacts/:id
 */
const deleteContactSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Contact ID is required'),
  }),
});

module.exports = {
  autocompleteSchema,
  createContactSchema,
  updateContactSchema,
  deleteContactSchema,
};
