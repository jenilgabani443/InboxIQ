'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../../shared/middlewares/authenticate');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const ApiError = require('../../shared/utils/apiError');

const Thread = require('./thread.model');
const { THREAD_STATUS } = require('../../shared/constants/emailStatus');

router.use(authenticate);

/**
 * @swagger
 * /threads:
 *   get:
 *     summary: Get all email threads
 *     description: Returns all threads that belong to the authenticated user.
 *     tags:
 *       - Threads
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Threads retrieved successfully.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const threads = await Thread.find({
      participants: req.user.id,
    })
      .sort({ lastEmailAt: -1 })
      .populate('emailIds', 'snippet from sentAt isRead')
      .lean();

    return ApiResponse.ok(res, 'Threads retrieved', threads);
  }),
);

/**
 * @swagger
 * /threads/{id}:
 *   get:
 *     summary: Get thread by ID
 *     description: Retrieve a single email thread.
 *     tags:
 *       - Threads
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Thread ID
 *         schema:
 *           type: string
 *         example: 6a41673f65033b0ee4a7d62c
 *     responses:
 *       200:
 *         description: Thread retrieved successfully.
 *       404:
 *         description: Thread not found.
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const thread = await Thread.findById(req.params.id)
      .populate({
        path: 'emailIds',
        populate: {
          path: 'attachments labels',
        },
      })
      .lean();

    if (!thread) {
      throw ApiError.notFound('Thread not found');
    }

    return ApiResponse.ok(res, 'Thread retrieved', thread);
  }),
);


/**
 * @swagger
 * /threads/{id}/status:
 *   patch:
 *     summary: Update thread status
 *     description: Change the status of a thread.
 *     tags:
 *       - Threads
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Thread ID
 *         schema:
 *           type: string
 *         example: 6a41673f65033b0ee4a7d62c
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 example: open
 *     responses:
 *       200:
 *         description: Thread status updated successfully.
 */
router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (!Object.values(THREAD_STATUS).includes(status)) {
      throw ApiError.badRequest('Invalid status');
    }

    const thread = await Thread.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );

    return ApiResponse.ok(res, 'Thread status updated', thread);
  }),
);

/**
 * @swagger
 * /threads/{id}/assign:
 *   patch:
 *     summary: Assign thread
 *     description: Assign a thread to a user.
 *     tags:
 *       - Threads
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Thread ID
 *         schema:
 *           type: string
 *         example: 6a41673f65033b0ee4a7d62c
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assignedTo:
 *                 type: string
 *                 example: 6a415c8084b77cb257623a85
 *     responses:
 *       200:
 *         description: Thread assigned successfully.
 */
router.patch(
  '/:id/assign',
  asyncHandler(async (req, res) => {
    const { assignedTo } = req.body;

    const thread = await Thread.findByIdAndUpdate(
      req.params.id,
      { assignedTo },
      { new: true },
    );

    return ApiResponse.ok(res, 'Thread assigned', thread);
  }),
);

/**
 * @swagger
 * /threads/{id}/notes:
 *   post:
 *     summary: Add internal note
 *     description: Add an internal note to a thread.
 *     tags:
 *       - Threads
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Thread ID
 *         schema:
 *           type: string
 *         example: 6a41673f65033b0ee4a7d62c
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - body
 *             properties:
 *               body:
 *                 type: string
 *                 example: Customer requested a callback tomorrow.
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Note added successfully.
 */
router.post(
  '/:id/notes',
  asyncHandler(async (req, res) => {
    const { body, mentions } = req.body;

    const thread = await Thread.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          internalNotes: {
            authorId: req.user.id,
            body,
            mentions: mentions || [],
          },
        },
      },
      { new: true },
    );

    return ApiResponse.created(
      res,
      'Note added',
      thread.internalNotes.at(-1),
    );
  }),
);

/**
 * @swagger
 * /threads/{id}/notes:
 *   get:
 *     summary: Get all internal notes
 *     description: Retrieve all internal notes for a thread.
 *     tags:
 *       - Threads
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Thread ID
 *         schema:
 *           type: string
 *         example: 6a41673f65033b0ee4a7d62c
 *     responses:
 *       200:
 *         description: Notes retrieved successfully.
 */
router.get(
  '/:id/notes',
  asyncHandler(async (req, res) => {
    const thread = await Thread.findById(req.params.id)
      .populate('internalNotes.authorId', 'displayName avatarUrl')
      .lean();

    return ApiResponse.ok(
      res,
      'Notes retrieved',
      thread?.internalNotes || [],
    );
  }),
);

/**
 * @swagger
 * /threads/{id}/notes/{noteId}:
 *   delete:
 *     summary: Delete an internal note
 *     description: Remove a specific internal note from a thread.
 *     tags:
 *       - Threads
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Thread ID
 *         schema:
 *           type: string
 *         example: 6a41673f65033b0ee4a7d62c
 *       - in: path
 *         name: noteId
 *         required: true
 *         description: Internal Note ID
 *         schema:
 *           type: string
 *         example: 6a418f6765033b0ee4a7d700
 *     responses:
 *       200:
 *         description: Note deleted successfully.
 */
router.delete(
  '/:id/notes/:noteId',
  asyncHandler(async (req, res) => {
    await Thread.findByIdAndUpdate(
      req.params.id,
      {
        $pull: {
          internalNotes: {
            _id: req.params.noteId,
          },
        },
      },
    );

    return ApiResponse.ok(res, 'Note deleted');
  }),
);

module.exports = router;