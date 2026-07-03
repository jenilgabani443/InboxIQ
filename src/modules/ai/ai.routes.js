'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../../shared/middlewares/authenticate');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const ApiError = require('../../shared/utils/apiError');
const Thread = require('../thread/thread.model');
const aiController = require('./ai.controller');

router.use(authenticate);

/**
 * @swagger
 * /ai/smart-replies/{emailId}:
 *   get:
 *     tags:
 *       - AI
 *     summary: Get 3 smart reply suggestions for an email
 *     description: Returns exactly three professional reply suggestions based on the email content (using a template-based engine).
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Smart replies generated
 *                 data:
 *                   type: object
 *                   properties:
 *                     emailId:
 *                       type: string
 *                       example: 6a464797f6b5a0ffe863137d
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: [
 *                         "Sounds good. I'll be there.",
 *                         "That time works for me.",
 *                         "I'll confirm shortly."
 *                       ]
 *       404:
 *         description: Email not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Email not found
 */
router.get('/smart-replies/:emailId', asyncHandler(aiController.getSmartReplies));

/**
 * @swagger
 * /ai/priority/{emailId}:
 *   get:
 *     tags:
 *       - AI
 *     summary: Calculate and get the priority score for an email
 *     description: Returns a priority score (0-100) and priority bucket (Low, Medium, High) for the given email based on deterministic rules.
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
 *         description: Priority calculated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Priority calculated
 *                 data:
 *                   type: object
 *                   properties:
 *                     emailId:
 *                       type: string
 *                       example: 6a464797f6b5a0ffe863137d
 *                     priorityScore:
 *                       type: number
 *                       example: 87
 *                     priority:
 *                       type: string
 *                       example: High
 *       404:
 *         description: Email not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Email not found
 */
router.get('/priority/:emailId', asyncHandler(aiController.getPriorityScore));

/**
 * @swagger
 * /ai/auto-label/{emailId}:
 *   post:
 *     tags:
 *       - AI
 *     summary: Auto-label an email based on content
 *     description: Analyzes the email subject, body, and snippet against predefined keyword rules. Reuses or creates matched labels and attaches them to the email.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: emailId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the email to analyze
 *     responses:
 *       200:
 *         description: Labels applied successfully or No labels matched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     emailId:
 *                       type: string
 *                     labels:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           color:
 *                             type: string
 *             examples:
 *               applied:
 *                 value:
 *                   success: true
 *                   message: "Labels applied successfully"
 *                   data:
 *                     emailId: "60d0fe4f5311236168a109ca"
 *                     labels:
 *                       - _id: "60d0fe4f5311236168a109cb"
 *                         name: "Urgent"
 *                         color: "#EF4444"
 *               no_match:
 *                 value:
 *                   success: true
 *                   message: "No labels matched"
 *                   data:
 *                     emailId: "60d0fe4f5311236168a109ca"
 *                     labels: []
 *       404:
 *         description: Email not found
 *       403:
 *         description: Access denied
 */
router.post('/auto-label/:emailId', asyncHandler(aiController.autoLabelEmail));

/**
 * @swagger
 * /ai/summary/{threadId}:
 *   get:
 *     tags:
 *       - AI
 *     summary: Get an AI-generated summary of a thread
 *     description: Analyzes all emails in a thread and generates a human-readable deterministic summary including participants, latest sender, and latest message snippet.
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     threadId:
 *                       type: string
 *                     subject:
 *                       type: string
 *                     summary:
 *                       type: string
 *                     participants:
 *                       type: array
 *                       items:
 *                         type: string
 *                     messageCount:
 *                       type: number
 *                     latestSender:
 *                       type: string
 *                     latestActivity:
 *                       type: string
 *             examples:
 *               success:
 *                 value:
 *                   success: true
 *                   message: "Thread summary generated"
 *                   data:
 *                     threadId: "6a4647f1f6b5a0ffe8631389"
 *                     subject: "Project Alpha"
 *                     summary: "Conversation about 'Project Alpha' containing 5 messages between Jenil Gabani, and Sarthak. The latest update was sent by Sarthak. They wrote: \"I have finished the deployment.\""
 *                     participants:
 *                       - "Jenil Gabani"
 *                       - "Sarthak"
 *                     messageCount: 5
 *                     latestSender: "Sarthak"
 *                     latestActivity: "2026-07-03T16:40:00Z"
 *       403:
 *         description: Access denied (User is not a participant in the thread)
 *       404:
 *         description: Thread not found.
 */
router.get('/summary/:threadId', asyncHandler(aiController.getThreadSummary));

/**
 * @swagger
 * /ai/unsubscribe/{emailId}:
 *   get:
 *     tags:
 *       - AI
 *     summary: Detect unsubscribe opportunities in an email
 *     description: Analyzes the email headers and body for standard unsubscribe headers or keywords indicating an opt-out opportunity.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: emailId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the email to analyze
 *     responses:
 *       200:
 *         description: Unsubscribe detection completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     emailId:
 *                       type: string
 *                     hasUnsubscribe:
 *                       type: boolean
 *                     detectedFrom:
 *                       type: string
 *                       nullable: true
 *                       example: "header"
 *                     reason:
 *                       type: string
 *                       nullable: true
 *             examples:
 *               hasHeader:
 *                 value:
 *                   success: true
 *                   message: "Unsubscribe option detected"
 *                   data:
 *                     emailId: "60d0fe4f5311236168a109ca"
 *                     hasUnsubscribe: true
 *                     detectedFrom: "header"
 *                     reason: "List-Unsubscribe header detected."
 *               hasBody:
 *                 value:
 *                   success: true
 *                   message: "Unsubscribe option detected"
 *                   data:
 *                     emailId: "60d0fe4f5311236168a109ca"
 *                     hasUnsubscribe: true
 *                     detectedFrom: "body"
 *                     reason: "Keyword 'unsubscribe' found in email body."
 *               none:
 *                 value:
 *                   success: true
 *                   message: "No unsubscribe option detected"
 *                   data:
 *                     emailId: "60d0fe4f5311236168a109ca"
 *                     hasUnsubscribe: false
 *                     detectedFrom: null
 *                     reason: null
 *       403:
 *         description: Access denied
 *       404:
 *         description: Email not found
 */
router.get('/unsubscribe/:emailId', asyncHandler(aiController.checkUnsubscribe));

module.exports = router;
