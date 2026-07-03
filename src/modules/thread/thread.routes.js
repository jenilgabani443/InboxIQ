'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../../shared/middlewares/authenticate');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const ApiError = require('../../shared/utils/apiError');

const Thread = require('./thread.model');
const User = require('../user/user.model');
const Notification = require('../notification/notification.model');
const { THREAD_STATUS, NOTIFICATION_TYPE } = require('../../shared/constants/emailStatus');
const validate = require('../../shared/middlewares/validate');
const { updateThreadStatusSchema, assignThreadSchema, addNoteSchema } = require('./thread.validator');
const { emitToUser } = require('../../config/socket');
const EVENTS = require('../../shared/constants/events');

router.use(authenticate);

/**
 * @swagger
 * /threads:
 *   get:
 *     summary: Get all email threads
 *     description: Returns all threads that belong to the authenticated user.
 *     tags:
 *       - Threads
 *     parameters:
 *       - in: query
 *         name: shared
 *         schema:
 *           type: boolean
 *           default: false
 *         description: If true, returns threads belonging to the user's team
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Threads retrieved successfully.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { shared } = req.query;
    const query = {};

    if (shared === 'true') {
      const user = await User.findById(req.user.id).select('teamId');
      if (!user || !user.teamId) {
        throw ApiError.badRequest('User does not belong to a team');
      }
      query.teamId = user.teamId;
    } else {
      query.participants = req.user.id;
    }

    const threads = await Thread.find(query)
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
  validate(updateThreadStatusSchema),
  asyncHandler(async (req, res) => {
    const { status } = req.body;

    const thread = await Thread.findById(req.params.id);

    if (!thread) {
      throw ApiError.notFound('Thread not found');
    }

    // Authorization: only participants can update status for now
    const isParticipant = thread.participants.some(p => p.toString() === req.user.id);
    if (!isParticipant) {
      throw ApiError.forbidden('You are not authorized to modify this thread');
    }

    thread.status = status;
    await thread.save();

    // Emit real-time event to all participants
    thread.participants.forEach(participantId => {
      try {
        emitToUser(participantId.toString(), EVENTS.THREAD_STATUS_CHANGED, {
          threadId: thread._id,
          status,
        });
      } catch (err) {
        // Ignore socket errors
      }
    });

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
  validate(assignThreadSchema),
  asyncHandler(async (req, res) => {
    const { assignedTo } = req.body;

    const thread = await Thread.findById(req.params.id);
    if (!thread) {
      throw ApiError.notFound('Thread not found');
    }

    // Authorization: only participants can assign thread for now
    const isParticipant = thread.participants.some(p => p.toString() === req.user.id);
    if (!isParticipant) {
      throw ApiError.forbidden('You are not authorized to modify this thread');
    }

    let assignee = null;
    if (assignedTo) {
      assignee = await User.findById(assignedTo);
      if (!assignee) {
        throw ApiError.notFound('Assigned user not found');
      }
    }

    const previousAssignedTo = thread.assignedTo?.toString();
    thread.assignedTo = assignedTo || null;
    await thread.save();

    // If newly assigned to a different user, create a notification
    if (assignedTo && assignedTo !== previousAssignedTo) {
      const notification = await Notification.create({
        userId: assignedTo,
        type: NOTIFICATION_TYPE.ASSIGNMENT,
        referenceId: thread._id,
        referenceModel: 'Thread',
        message: `You have been assigned to thread: ${thread.subject}`,
      });

      try {
        emitToUser(assignedTo, EVENTS.NOTIFICATION, notification);
      } catch (err) {
        // Ignore socket errors
      }
    }

    // Emit real-time event to all participants
    thread.participants.forEach(participantId => {
      try {
        emitToUser(participantId.toString(), EVENTS.THREAD_ASSIGNED, {
          threadId: thread._id,
          assignedTo: thread.assignedTo,
        });
      } catch (err) {
        // Ignore socket errors
      }
    });

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
  validate(addNoteSchema),
  asyncHandler(async (req, res) => {
    const { body, mentions } = req.body;

    const thread = await Thread.findById(req.params.id);
    if (!thread) {
      throw ApiError.notFound('Thread not found');
    }

    const isParticipant = thread.participants.some(p => p.toString() === req.user.id);
    if (!isParticipant) {
      throw ApiError.forbidden('You are not authorized to access this thread');
    }

    const uniqueMentions = [...new Set(mentions || [])];

    if (uniqueMentions.length > 0) {
      const usersCount = await User.countDocuments({ _id: { $in: uniqueMentions } });
      if (usersCount !== uniqueMentions.length) {
        throw ApiError.badRequest('One or more mentioned users do not exist');
      }
    }

    const updatedThread = await Thread.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          internalNotes: {
            authorId: req.user.id,
            body,
            mentions: uniqueMentions,
          },
        },
      },
      { new: true },
    );

    const newNote = updatedThread.internalNotes.at(-1);

    // Emit real-time event to all participants
    updatedThread.participants.forEach(participantId => {
      try {
        emitToUser(participantId.toString(), EVENTS.THREAD_NOTE_ADDED, {
          threadId: updatedThread._id,
          note: newNote,
        });
      } catch (err) {
        // Ignore socket errors
      }
    });

    // Create notifications for mentioned users
    for (const mentionedId of uniqueMentions) {
      try {
        const notification = await Notification.create({
          userId: mentionedId,
          type: NOTIFICATION_TYPE.MENTION,
          referenceId: thread._id,
          referenceModel: 'Thread',
          message: `You were mentioned in a note on thread: ${thread.subject}`,
        });

        emitToUser(mentionedId.toString(), EVENTS.NOTIFICATION, notification);
      } catch (err) {
        // Ignore any errors to ensure API request does not fail
      }
    }

    return ApiResponse.created(res, 'Note added', newNote);
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

    if (!thread) {
      throw ApiError.notFound('Thread not found');
    }

    const isParticipant = thread.participants.some(p => p.toString() === req.user.id);
    if (!isParticipant) {
      throw ApiError.forbidden('You are not authorized to access this thread');
    }

    return ApiResponse.ok(
      res,
      'Notes retrieved',
      thread.internalNotes || [],
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
    const thread = await Thread.findById(req.params.id);
    if (!thread) {
      throw ApiError.notFound('Thread not found');
    }

    const isParticipant = thread.participants.some(p => p.toString() === req.user.id);
    if (!isParticipant) {
      throw ApiError.forbidden('You are not authorized to access this thread');
    }

    const note = thread.internalNotes.id(req.params.noteId);
    if (!note) {
      throw ApiError.notFound('Note not found');
    }

    if (note.authorId.toString() !== req.user.id) {
      throw ApiError.forbidden('You can only delete your own notes');
    }

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