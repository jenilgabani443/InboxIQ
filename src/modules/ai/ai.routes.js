'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../../shared/middlewares/authenticate');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const ApiError = require('../../shared/utils/apiError');
const Email = require('../email/email.model');
const Thread = require('../thread/thread.model');

router.use(authenticate);

/**
 * @swagger
 * /ai/smart-replies/{emailId}:
 *   get:
 *     tags:
 *       - AI
 *     summary: Get 3 smart reply suggestions for an email
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: emailId
 *         required: true
 *         description: Email ID
 *         schema:
 *           type: string
 *         example: 6a464797f6b5a0ffe863137d
 *     responses:
 *       200:
 *         description: Smart replies generated successfully.
 *       404:
 *         description: Email not found.
 */
router.get('/smart-replies/:emailId', asyncHandler(async (req, res) => {
  const email = await Email.findById(req.params.emailId).lean();
  if (!email) throw ApiError.notFound('Email not found');

  // v1: Rule-based templates. v2: Replace with OpenAI/Gemini API call
  const suggestions = [
    'Thanks for reaching out! I\'ll get back to you shortly.',
    'Received, I\'ll review this and respond by end of day.',
    'Acknowledged — let me check on this and follow up.',
  ];

  return ApiResponse.ok(res, 'Smart replies generated', { suggestions });
}));

/**
 * @swagger
 * /ai/summary/{threadId}:
 *   get:
 *     tags:
 *       - AI
 *     summary: Get an AI-generated summary of a thread
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         description: Thread ID
 *         schema:
 *           type: string
 *         example: 6a4647f1f6b5a0ffe8631389
 *     responses:
 *       200:
 *         description: Thread summary generated.
 *       404:
 *         description: Thread not found.
 */
router.get('/summary/:threadId', asyncHandler(async (req, res) => {
  const thread = await Thread.findById(req.params.threadId).populate('emailIds', 'snippet from sentAt').lean();
  if (!thread) throw ApiError.notFound('Thread not found');

  // v1: Concat snippets. v2: Replace with LLM summarization
  const summary = thread.emailIds
    .map((e) => `[${e.from.name || e.from.email}]: ${e.snippet}`)
    .join('\n');

  return ApiResponse.ok(res, 'Thread summary', { summary: summary.slice(0, 1000) });
}));

/**
 * @swagger
 * /ai/score:
 *   post:
 *     tags:
 *       - AI
 *     summary: Trigger priority re-score for user's inbox
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Priority scoring queued.
 */
router.post('/score', asyncHandler(async (req, res) => {
  // v1: Score based on recency + sender frequency. v2: ML model
  // This would normally be a background Bull job
  return ApiResponse.ok(res, 'Priority scoring queued. Scores will update shortly.');
}));

module.exports = router;
