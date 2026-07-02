'use strict';

/**
 * Email routes — Full implementation
 * All endpoints are protected with authenticate middleware.
 */
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const authenticate = require('../../shared/middlewares/authenticate');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const ApiError = require('../../shared/utils/apiError');
const { paginate } = require('../../shared/utils/pagination');
const { emitToUser } = require('../../config/socket');
const EVENTS = require('../../shared/constants/events');

const Email = require('./email.model');
const Thread = require('../thread/thread.model');
const { EMAIL_STATUS, EMAIL_FOLDER } = require('../../shared/constants/emailStatus');

// All email routes require authentication
router.use(authenticate);


/**
 * @swagger
 * /emails:
 *   get:
 *     tags:
 *       - Emails
 *     summary: List emails by folder or label
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: folder
 *         schema:
 *           type: string
 *           enum:
 *             - inbox
 *             - sent
 *             - drafts
 *             - trash
 *             - spam
 *             - archive
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Emails retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { folder = 'inbox', page = 1, limit = 20, label } = req.query;

    const query = { 'from.userId': req.user.id };
    if (label) {
      query.labels = label;
    } else {
      query.folder = folder;
    }

    const total = await Email.countDocuments(query);
    const { skip, limit: lim, meta } = paginate({ page, limit, total });

    const emails = await Email.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .select('-bodyHtml -bodyText')
      .populate('attachments', 'filename sizeBytes mimeType')
      .populate('labels', 'name color')
      .lean();

    return ApiResponse.ok(res, 'Emails retrieved', emails, meta);
  }),
);

/**
 * @swagger
 * /emails:
 *   post:
 *     tags:
 *       - Emails
 *     summary: Compose and send (or save draft) an email
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               to:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *               subject:
 *                 type: string
 *               bodyHtml:
 *                 type: string
 *               bodyText:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum:
 *                   - draft
 *                   - sent
 *     responses:
 *       201:
 *         description: Email created successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { to, cc, bcc, subject, bodyHtml, bodyText, attachments, scheduledAt, status = 'draft' } = req.body;

    const user = { userId: req.user.id, email: req.user.email, name: req.user.displayName || '' };

    // Find or create thread
    let thread = await Thread.findOne({
      participants: req.user.id,
      subject: { $regex: new RegExp(`^(Re: |Fwd: )*${subject}$`, 'i') },
    });

    if (!thread) {
      thread = await Thread.create({
        subject,
        participants: [req.user.id],
        messageCount: 0,
      });
    }

    const undoSeconds = 10; // TODO: read from user.preferences.undoSendSeconds
    const undoExpiry = status === EMAIL_STATUS.SENT ? new Date(Date.now() + undoSeconds * 1000) : null;

    const email = await Email.create({
      threadId: thread._id,
      messageId: `<${uuidv4()}@inboxiq.app>`,
      from: user,
      to: to || [],
      cc: cc || [],
      bcc: bcc || [],
      subject,
      bodyHtml: bodyHtml || '',
      bodyText: bodyText || '',
      attachments: attachments || [],
      status: scheduledAt ? EMAIL_STATUS.SCHEDULED : status,
      folder: status === EMAIL_STATUS.SENT ? EMAIL_FOLDER.SENT : EMAIL_FOLDER.DRAFTS,
      scheduledAt: scheduledAt || null,
      sentAt: status === EMAIL_STATUS.SENT ? new Date() : null,
      undoExpiry,
    });

    // Update thread
    await Thread.findByIdAndUpdate(thread._id, {
      $push: { emailIds: email._id },
      $inc: { messageCount: 1 },
      lastEmailAt: new Date(),
    });

    // Emit real-time event to recipients
    if (status === EMAIL_STATUS.SENT && to?.length) {
      to.forEach(({ email: recipientEmail }) => {
        emitToUser(recipientEmail, EVENTS.NEW_EMAIL, {
          emailId: email._id,
          from: user,
          subject,
          snippet: email.snippet,
          sentAt: email.sentAt,
        });
      });
    }

    return ApiResponse.created(res, 'Email created', email);
  }),
);

/**
 * @swagger
 * /emails/search:
 *   get:
 *     tags:
 *       - Emails
 *     summary: Search emails
 *     description: Search emails by text, sender, recipient, label, date range or attachment.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search text in subject, snippet or body
 *         example: Hello
 *
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *         description: Sender email address
 *         example: john@example.com
 *
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *         description: Recipient email address
 *         example: jenil@example.com
 *
 *       - in: query
 *         name: label
 *         schema:
 *           type: string
 *         description: Label ID
 *
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Return emails before this date
 *
 *       - in: query
 *         name: after
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Return emails after this date
 *
 *       - in: query
 *         name: hasAttachment
 *         schema:
 *           type: boolean
 *         description: Filter emails with attachments
 *
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *
 *     responses:
 *       200:
 *         description: Search completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *
 *       400:
 *         description: Invalid search parameters
 *
 *       401:
 *         description: Unauthorized
 *
 *       500:
 *         description: Internal server error
 */
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const { q, from: fromEmail, to: toEmail, label, before, after, hasAttachment, page = 1, limit = 20 } = req.query;

    if (!q && !fromEmail && !toEmail && !label) {
      throw ApiError.badRequest('At least one search parameter is required');
    }

    const query = { 'from.userId': req.user.id };

    if (q) {
      query.$or = [
        { subject: { $regex: q, $options: 'i' } },
        { snippet: { $regex: q, $options: 'i' } },
        { bodyText: { $regex: q, $options: 'i' } },
      ];
    }
    if (fromEmail) query['from.email'] = { $regex: fromEmail, $options: 'i' };
    if (toEmail) query['to.email'] = { $regex: toEmail, $options: 'i' };
    if (label) query.labels = label;
    if (hasAttachment === 'true') query.attachments = { $not: { $size: 0 } };
    if (before) query.createdAt = { ...query.createdAt, $lte: new Date(before) };
    if (after) query.createdAt = { ...query.createdAt, $gte: new Date(after) };

    const total = await Email.countDocuments(query);
    const { skip, limit: lim, meta } = paginate({ page, limit, total });
    const results = await Email.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).select('-bodyHtml').lean();

    return ApiResponse.ok(res, 'Search results', results, meta);
  }),
);

/**
 * @swagger
 * /emails/{id}:
 *   get:
 *     tags:
 *       - Emails
 *     summary: Get email by ID
 *     description: Retrieve a single email.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 6a41687065033b0ee4a7d63c
 *     responses:
 *       200:
 *         description: Email retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Email not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const email = await Email.findById(req.params.id)
      .populate('attachments')
      .populate('labels', 'name color')
      .lean();

    if (!email) throw ApiError.notFound('Email not found');
    if (email.from.userId.toString() !== req.user.id) throw ApiError.forbidden('Access denied');

    return ApiResponse.ok(res, 'Email retrieved', email);
  }),
);
/**
 * @swagger
 * /emails/{id}:
 *   patch:
 *     tags:
 *       - Emails
 *     summary: Update a draft email
 *     description: Update an existing draft email.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 6a41687065033b0ee4a7d63c
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *               bodyText:
 *                 type: string
 *               bodyHtml:
 *                 type: string
 *               to:
 *                 type: array
 *                 items:
 *                   type: object
 *               cc:
 *                 type: array
 *                 items:
 *                   type: object
 *               bcc:
 *                 type: array
 *                 items:
 *                   type: object
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Draft updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Only draft emails can be edited
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Email not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const email = await Email.findOne({ _id: req.params.id, 'from.userId': req.user.id });
    if (!email) throw ApiError.notFound('Email not found');
    if (email.status !== EMAIL_STATUS.DRAFT) throw ApiError.badRequest('Only drafts can be edited');

    const allowed = ['to', 'cc', 'bcc', 'subject', 'bodyHtml', 'bodyText', 'attachments'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) email[field] = req.body[field];
    });

    await email.save();
    return ApiResponse.ok(res, 'Draft updated', email);
  }),
);

/**
 * @swagger
 * /emails/{id}:
 *   delete:
 *     tags:
 *       - Emails
 *     summary: Move an email to trash or permanently delete it
 *     description: |
 *       If the email is not in Trash, it is moved to the Trash folder.
 *       If it is already in Trash, it is permanently deleted.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Email ID
 *         schema:
 *           type: string
 *         example: 64a62f5cb25241213cf796b9
 *     responses:
 *       200:
 *         description: Email deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             examples:
 *               movedToTrash:
 *                 summary: Email moved to trash
 *                 value:
 *                   success: true
 *                   message: Email moved to trash
 *                   data: null
 *                   meta: null
 *                   errors: null
 *                   timestamp: "2026-07-02T09:00:00.000Z"
 *               permanentlyDeleted:
 *                 summary: Email permanently deleted
 *                 value:
 *                   success: true
 *                   message: Email permanently deleted
 *                   data: null
 *                   meta: null
 *                   errors: null
 *                   timestamp: "2026-07-02T09:00:00.000Z"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Email not found
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const email = await Email.findOne({ _id: req.params.id, 'from.userId': req.user.id });
    if (!email) throw ApiError.notFound('Email not found');

    if (email.folder === EMAIL_FOLDER.TRASH) {
      // Hard delete if already in trash
      email.isDeleted = true;
      email.deletedAt = new Date();
    } else {
      email.folder = EMAIL_FOLDER.TRASH;
    }

    await email.save();
    return ApiResponse.ok(res, email.isDeleted ? 'Email permanently deleted' : 'Email moved to trash');
  }),
);

/**
 * @swagger
 * /emails/{id}/read:
 *   patch:
 *     tags:
 *       - Emails
 *     summary: Mark email as read or unread
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Email ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isRead:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Email updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Email not found
 */
router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const { isRead = true } = req.body;
    const email = await Email.findOneAndUpdate(
      { _id: req.params.id, 'from.userId': req.user.id },
      { isRead, readAt: isRead ? new Date() : null },
      { new: true },
    );
    if (!email) throw ApiError.notFound('Email not found');
    return ApiResponse.ok(res, `Email marked as ${isRead ? 'read' : 'unread'}`);
  }),
);

/**
 * @swagger
 * /emails/{id}/star:
 *   patch:
 *     tags:
 *       - Emails
 *     summary: Star or unstar an email
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Email ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isStarred:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Email updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Email not found
 */
router.patch(
  '/:id/star',
  asyncHandler(async (req, res) => {
    const { isStarred = true } = req.body;
    const email = await Email.findOneAndUpdate(
      { _id: req.params.id, 'from.userId': req.user.id },
      { isStarred },
      { new: true },
    );
    if (!email) throw ApiError.notFound('Email not found');
    return ApiResponse.ok(res, `Email ${isStarred ? 'starred' : 'unstarred'}`);
  }),
);

/**
 * @swagger
 * /emails/{id}/archive:
 *   patch:
 *     tags:
 *       - Emails
 *     summary: Archive an email
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Email ID
 *     responses:
 *       200:
 *         description: Email archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Email not found
 */
router.patch(
  '/:id/archive',
  asyncHandler(async (req, res) => {
    const email = await Email.findOneAndUpdate(
      { _id: req.params.id, 'from.userId': req.user.id },
      { folder: EMAIL_FOLDER.ARCHIVE },
      { new: true },
    );
    if (!email) throw ApiError.notFound('Email not found');
    return ApiResponse.ok(res, 'Email archived');
  }),
);

/**
 * @swagger
 * /emails/{id}/snooze:
 *   patch:
 *     tags:
 *       - Emails
 *     summary: Snooze an email until a future time
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Email ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - snoozeUntil
 *             properties:
 *               snoozeUntil:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-07-10T10:30:00.000Z"
 *     responses:
 *       200:
 *         description: Email snoozed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Invalid snooze date
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Email not found
 */
router.patch(
  '/:id/snooze',
  asyncHandler(async (req, res) => {
    const { snoozeUntil } = req.body;
    if (!snoozeUntil) throw ApiError.badRequest('snoozeUntil is required');

    const snoozeDate = new Date(snoozeUntil);
    if (snoozeDate <= new Date()) throw ApiError.badRequest('snoozeUntil must be in the future');

    const email = await Email.findOneAndUpdate(
      { _id: req.params.id, 'from.userId': req.user.id },
      { isSnoozed: true, snoozeUntil: snoozeDate },
      { new: true },
    );
    if (!email) throw ApiError.notFound('Email not found');

    // TODO: Schedule Bull snooze job
    return ApiResponse.ok(res, 'Email snoozed', { snoozeUntil: email.snoozeUntil });
  }),
);
/**
 * @swagger
 * /emails/{id}/move:
 *   patch:
 *     tags:
 *       - Emails
 *     summary: Move an email to another folder
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Email ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - folder
 *             properties:
 *               folder:
 *                 type: string
 *                 enum:
 *                   - inbox
 *                   - sent
 *                   - drafts
 *                   - trash
 *                   - spam
 *                   - archive
 *                 example: archive
 *     responses:
 *       200:
 *         description: Email moved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Invalid folder
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Email not found
 */
router.patch(
  '/:id/move',
  asyncHandler(async (req, res) => {
    const { folder } = req.body;
    const validFolders = Object.values(EMAIL_FOLDER);
    if (!validFolders.includes(folder)) throw ApiError.badRequest(`Invalid folder: ${folder}`);

    const email = await Email.findOneAndUpdate(
      { _id: req.params.id, 'from.userId': req.user.id },
      { folder },
      { new: true },
    );
    if (!email) throw ApiError.notFound('Email not found');
    return ApiResponse.ok(res, `Email moved to ${folder}`);
  }),
);

module.exports = router;