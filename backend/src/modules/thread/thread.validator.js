'use strict';

const { z } = require('zod');
const { THREAD_STATUS } = require('../../shared/constants/emailStatus');

const updateThreadStatusSchema = z.object({
  body: z.object({
    status: z.enum(Object.values(THREAD_STATUS), {
      errorMap: () => ({ message: 'Invalid thread status' }),
    }),
  }),
});

const assignThreadSchema = z.object({
  body: z.object({
    assignedTo: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format')
      .nullable(),
  }),
});

const addNoteSchema = z.object({
  body: z.object({
    body: z.string().min(1).max(10000),
    mentions: z
      .array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format'))
      .optional()
      .default([]),
  }),
});

module.exports = {
  updateThreadStatusSchema,
  assignThreadSchema,
  addNoteSchema,
};
