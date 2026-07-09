'use strict';

/**
 * Email routes — Full implementation
 * All endpoints are protected with authenticate middleware.
 */
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const authenticate = require('../../shared/middlewares/authenticate');
const validate = require('../../shared/middlewares/validate');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const ApiError = require('../../shared/utils/apiError');
const { paginate } = require('../../shared/utils/pagination');
const { emitToUser } = require('../../config/socket');
const EVENTS = require('../../shared/constants/events');

const Email = require('./email.model');
const User = require('../user/user.model');
const Thread = require('../thread/thread.model');
const { EMAIL_STATUS, EMAIL_FOLDER } = require('../../shared/constants/emailStatus');
const { searchEmailsSchema, bulkOperationsSchema } = require('./email.validator');
const emailService = require('./email.service');
const searchService = require('../search/search.service');
const { emailQueue, snoozeQueue, filterQueue } = require('../../config/queue');
const auditService = require('../audit/audit.service');

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
 *       - in: query
 *         name: shared
 *         schema:
 *           type: boolean
 *           default: false
 *         description: If true, returns emails belonging to the user's team
 *     responses:
 *       200:
 *         description: Emails retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { folder = 'inbox', page = 1, limit = 20, label, shared } = req.query;

    const query = {};

    if (shared === 'true') {
      const user = await User.findById(req.user.id).select('teamId');
      console.log('Authenticated user ID:', req.user.id);

      console.log('User from DB:', user);
      if (!user || !user.teamId) {
        throw ApiError.badRequest('User does not belong to a team');
      }
      query.teamId = user.teamId;
    } else {
      query['from.userId'] = req.user.id;
    }

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
 *     summary: Compose, send, schedule (or save draft) an email
 *     description: |
 *       Creates an email. Behaviour depends on the provided fields:
 *       - `status: 'draft'` (default) — saves as a draft
 *       - `status: 'sent'` — immediately marks as sent; an undo window is applied
 *         based on the user's `preferences.undoSendSeconds` setting (default 10s)
 *       - `scheduledAt` provided — sets `status: 'scheduled'` and enqueues a
 *         background job that transitions the email to `sent` at the specified time.
 *         `scheduledAt` must be a future ISO 8601 date and no more than 1 year ahead.
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
 *                 description: Ignored when scheduledAt is provided
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Future ISO date to schedule delivery. Must be within 1 year.
 *                 example: "2026-12-01T09:00:00.000Z"
 *     responses:
 *       201:
 *         description: Email created successfully (draft, sent, or scheduled)
 *       400:
 *         description: Invalid request or scheduledAt validation failure
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { to, cc, bcc, subject, bodyHtml, bodyText, attachments, scheduledAt, status = 'draft' } = req.body;

    const user = { userId: req.user.id, email: req.user.email, name: req.user.displayName || '' };

    // Read preferences and teamId from sender
    const sender = await User.findById(req.user.id).select('preferences teamId').lean();
    const teamId = sender?.teamId || null;

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
        teamId,
      });
    }

    const undoSeconds = sender?.preferences?.undoSendSeconds ?? 10;
    const undoExpiry = status === EMAIL_STATUS.SENT ? new Date(Date.now() + undoSeconds * 1000) : null;

    // Validate scheduledAt: must be a future date
    if (scheduledAt) {
      const schedDate = new Date(scheduledAt);
      if (isNaN(schedDate.getTime())) {
        throw ApiError.badRequest('scheduledAt must be a valid ISO date string');
      }
      if (schedDate <= new Date()) {
        throw ApiError.badRequest('scheduledAt must be a future date');
      }
      const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      if (schedDate > oneYearFromNow) {
        throw ApiError.badRequest('scheduledAt cannot be more than 1 year in the future');
      }
    }

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
      folder: scheduledAt ? EMAIL_FOLDER.DRAFTS : (status === EMAIL_STATUS.SENT ? EMAIL_FOLDER.SENT : EMAIL_FOLDER.DRAFTS),
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      sentAt: status === EMAIL_STATUS.SENT ? new Date() : null,
      undoExpiry,
      teamId,
    });

    // Update thread
    await Thread.findByIdAndUpdate(thread._id, {
      $push: { emailIds: email._id },
      $inc: { messageCount: 1 },
      lastEmailAt: new Date(),
    });

    // Schedule Bull job for delayed delivery
    if (scheduledAt) {
      const delay = new Date(scheduledAt).getTime() - Date.now();
      await emailQueue.add(
        'send_scheduled_email',
        { emailId: email._id.toString(), userId: req.user.id },
        {
          delay,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          jobId: `scheduled:${email._id}`,
          removeOnComplete: 20,
          removeOnFail: 50,
        },
      );
    }

    // Emit real-time event to recipients (for immediately sent emails only)
    // Wrapped in try/catch — Socket.IO is not available in test environment.
    if (status === EMAIL_STATUS.SENT && !scheduledAt && to?.length) {
      try {
        to.forEach(({ email: recipientEmail }) => {
          emitToUser(recipientEmail, EVENTS.NEW_EMAIL, {
            emailId: email._id,
            from: user,
            subject,
            snippet: email.snippet,
            sentAt: email.sentAt,
          });
        });
      } catch (_socketErr) {
        // Non-fatal — socket may not be available in test / worker-only contexts
      }
    }

    // Schedule Bull job to apply user filters to this new email
    await filterQueue.add(
      'apply_filters',
      { emailId: email._id.toString(), userId: req.user.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 20,
        removeOnFail: 50,
      }
    );

    if (status === EMAIL_STATUS.SENT) {
      auditService.logAudit({
        userId: req.user.id,
        action: 'EMAIL_SENT',
        resourceType: 'Email',
        resourceId: email._id.toString(),
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    }

    return ApiResponse.created(res, 'Email created', email);
  }),
);

/**
 * @swagger
 * /emails/bulk:
 *   patch:
 *     tags:
 *       - Emails
 *     summary: Perform bulk operations on emails
 *     description: |
 *       Perform bulk operations on multiple emails at once.
 *       Supported operations:
 *       - `markRead` / `markUnread`
 *       - `archive`
 *       - `trash` (Moves to trash. If already in trash, permanently deletes)
 *       - `restore` (Moves from trash to inbox)
 *       - `applyLabels` / `removeLabels` (Requires `labels` array)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emailIds
 *               - operation
 *             properties:
 *               emailIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               operation:
 *                 type: string
 *                 enum: [markRead, markUnread, archive, trash, restore, applyLabels, removeLabels]
 *               labels:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Required for applyLabels and removeLabels operations
 *     responses:
 *       200:
 *         description: Bulk operation completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Invalid request payload
 *       401:
 *         description: Unauthorized
 */
router.patch(
  '/bulk',
  validate(bulkOperationsSchema),
  asyncHandler(async (req, res) => {
    const { emailIds, operation, labels } = req.body;
    const userId = req.user.id;

    // Filter out invalid ObjectIds to prevent cast errors
    const validIds = emailIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return ApiResponse.ok(res, 'Bulk operation completed', { successful: 0, failed: emailIds.length });
    }

    const query = { _id: { $in: validIds }, 'from.userId': userId };
    let result = { modifiedCount: 0 };
    let resultSecondary = { modifiedCount: 0 };

    switch (operation) {
      case 'markRead':
        result = await Email.updateMany(query, { isRead: true, readAt: new Date() });
        break;
      case 'markUnread':
        result = await Email.updateMany(query, { isRead: false, readAt: null });
        break;
      case 'archive':
        result = await Email.updateMany(
          { ...query, folder: { $nin: [EMAIL_FOLDER.ARCHIVE, EMAIL_FOLDER.TRASH] } },
          { folder: EMAIL_FOLDER.ARCHIVE }
        );
        break;
      case 'restore':
        result = await Email.updateMany(
          { ...query, folder: EMAIL_FOLDER.TRASH },
          { folder: EMAIL_FOLDER.INBOX }
        );
        break;
      case 'trash':
        // 1. Permanently delete (soft delete) those already in TRASH
        resultSecondary = await Email.updateMany(
          { ...query, folder: EMAIL_FOLDER.TRASH },
          { isDeleted: true, deletedAt: new Date() }
        );
        // 2. Move others to TRASH
        result = await Email.updateMany(
          { ...query, folder: { $ne: EMAIL_FOLDER.TRASH } },
          { folder: EMAIL_FOLDER.TRASH }
        );
        break;
      case 'applyLabels':
        result = await Email.updateMany(query, { $addToSet: { labels: { $each: labels } } });
        break;
      case 'removeLabels':
        result = await Email.updateMany(query, { $pullAll: { labels } });
        break;
    }

    const totalModified = result.modifiedCount + (resultSecondary.modifiedCount || 0);

    // After bulk update, emit real-time events to sync client (best-effort)
    try {
      const updatedEmails = await Email.find(query).select('folder isRead isStarred labels').lean();
      updatedEmails.forEach(email => {
        emitToUser(userId, EVENTS.EMAIL_UPDATED, {
          emailId: email._id,
          folder: email.folder,
          isRead: email.isRead,
          isStarred: email.isStarred,
          labels: email.labels,
        });
      });
    } catch (err) {
      // Ignore socket errors
    }

    // Determine successful and failed counts using MongoDB update result
    const successful = (result.matchedCount || 0) + (resultSecondary.matchedCount || 0);
    const failed = emailIds.length - successful;

    return ApiResponse.ok(res, 'Bulk operation completed', {
      successful,
      failed,
      modified: totalModified,
    });
  })
);

/**
 * @swagger
 * /emails/search:
 *   get:
 *     tags:
 *       - Emails
 *     summary: Full-text email search with Gmail-style operators
 *     description: |
 *       Search emails using free-text or Gmail-style operators. Operators can be
 *       combined in a single `q` string, e.g. `from:john@example.com subject:meeting has:attachment`.
 *
 *       **Supported operators in `q`:**
 *       - `from:email` — filter by sender
 *       - `to:email` — filter by recipient
 *       - `cc:email` — filter by CC
 *       - `bcc:email` — filter by BCC
 *       - `subject:text` — filter by subject
 *       - `label:name` — filter by label
 *       - `has:attachment` — only emails with attachments
 *       - `is:read` / `is:unread` — read status
 *       - `before:YYYY-MM-DD` — emails before date
 *       - `after:YYYY-MM-DD` — emails after date
 *       - `in:inbox|sent|drafts|trash|spam|archive` — folder filter
 *
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Free-text or Gmail-style operator query
 *         example: "from:john@example.com subject:meeting has:attachment"
 *
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *         description: Sender email address (overrides `from:` operator)
 *         example: john@example.com
 *
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *         description: Recipient email address (overrides `to:` operator)
 *         example: jenil@example.com
 *
 *       - in: query
 *         name: cc
 *         schema:
 *           type: string
 *         description: CC email address
 *
 *       - in: query
 *         name: bcc
 *         schema:
 *           type: string
 *         description: BCC email address
 *
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *         description: Subject text filter
 *
 *       - in: query
 *         name: label
 *         schema:
 *           type: string
 *         description: Label ID
 *
 *       - in: query
 *         name: attachmentName
 *         schema:
 *           type: string
 *         description: Attachment filename substring filter
 *         example: invoice
 *
 *       - in: query
 *         name: folder
 *         schema:
 *           type: string
 *           enum: [inbox, sent, drafts, trash, spam, archive]
 *         description: Folder filter
 *
 *       - in: query
 *         name: hasAttachment
 *         schema:
 *           type: boolean
 *         description: Filter emails that have at least one attachment
 *
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *         description: Filter by read status
 *
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *           example: "2024-12-31"
 *         description: Return emails created before this date (YYYY-MM-DD)
 *
 *       - in: query
 *         name: after
 *         schema:
 *           type: string
 *           example: "2024-01-01"
 *         description: Return emails created after this date (YYYY-MM-DD)
 *
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, sentAt, subject, priorityScore]
 *           default: createdAt
 *
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
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
 *           maximum: 100
 *
 *     responses:
 *       200:
 *         description: Search completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: Search results
 *               data:
 *                 - _id: "64a62f5cb25241213cf796b9"
 *                   subject: "Team meeting tomorrow"
 *                   snippet: "Hi team, let's meet at 10am..."
 *                   from:
 *                     email: "john@example.com"
 *                     name: "John Doe"
 *                   sentAt: "2024-06-01T10:00:00.000Z"
 *               meta:
 *                 page: 1
 *                 limit: 20
 *                 total: 1
 *                 totalPages: 1
 *                 hasNextPage: false
 *                 hasPrevPage: false
 *               errors: null
 *               timestamp: "2024-06-01T10:00:00.000Z"
 *
 *       400:
 *         description: Bad request — no search filter provided
 *
 *       401:
 *         description: Unauthorized
 *
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: Validation failed
 *               errors:
 *                 - field: before
 *                   message: Must be a valid date in YYYY-MM-DD format
 *                   code: custom
 *
 *       500:
 *         description: Internal server error
 */
router.get(
  '/search',
  validate(searchEmailsSchema),
  asyncHandler(async (req, res) => {
    const { page, limit, sortBy, sortOrder, ...filters } = req.query;

    const { results, meta } = await emailService.searchEmails(
      req.user.id,
      filters,
      { page, limit, sortBy, sortOrder },
    );

    // Record the query in search history (best-effort — errors are non-fatal)
    // Use q if provided, otherwise build a compact label from explicit filters.
    const historyQuery = filters.q || [
      filters.from && `from:${filters.from}`,
      filters.to && `to:${filters.to}`,
      filters.subject && `subject:${filters.subject}`,
      filters.folder && `in:${filters.folder}`,
      filters.isRead === true && 'is:read',
      filters.isRead === false && 'is:unread',
      filters.hasAttachment === true && 'has:attachment',
    ]
      .filter(Boolean)
      .join(' ');

    if (historyQuery) {
      searchService.addToHistory(req.user.id, historyQuery).catch(() => { });
    }

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

    auditService.logAudit({
      userId: req.user.id,
      action: 'EMAIL_UPDATED',
      resourceType: 'Email',
      resourceId: email._id.toString(),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

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

    // Update thread
    await Thread.findByIdAndUpdate(email.threadId, {
      $inc: { messageCount: -1 },
    });

    auditService.logAudit({
      userId: req.user.id,
      action: 'EMAIL_DELETED',
      resourceType: 'Email',
      resourceId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

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

    auditService.logAudit({
      userId: req.user.id,
      action: 'EMAIL_ARCHIVED',
      resourceType: 'Email',
      resourceId: email._id.toString(),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

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
 *     description: |
 *       Hides the email from the inbox until the specified time. When the snooze
 *       expires, a background job restores the email to the inbox and creates an
 *       in-app notification. Re-snoozing an already-snoozed email replaces the
 *       existing job (only one active snooze job per email at a time).
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
 *                 description: Future ISO date when the email should return to inbox
 *                 example: "2026-07-10T10:30:00.000Z"
 *     responses:
 *       200:
 *         description: Email snoozed successfully — background job scheduled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Invalid snooze date (not a future date)
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
    if (isNaN(snoozeDate.getTime())) throw ApiError.badRequest('snoozeUntil must be a valid ISO date string');
    if (snoozeDate <= new Date()) throw ApiError.badRequest('snoozeUntil must be in the future');

    const email = await Email.findOneAndUpdate(
      { _id: req.params.id, 'from.userId': req.user.id },
      { isSnoozed: true, snoozeUntil: snoozeDate },
      { new: true },
    );
    if (!email) throw ApiError.notFound('Email not found');

    // Schedule Bull snooze job — fires when snoozeUntil is reached.
    // jobId 'snooze:{emailId}' ensures only one active snooze job per email.
    // Re-snoozing replaces the old waiting job automatically via Bull deduplication.
    const delay = snoozeDate.getTime() - Date.now();
    await snoozeQueue.add(
      'process_snooze',
      { emailId: email._id.toString(), userId: req.user.id },
      {
        delay,
        attempts: 2,
        backoff: { type: 'fixed', delay: 10000 },
        jobId: `snooze:${email._id}`,
        removeOnComplete: 10,
        removeOnFail: 20,
      },
    );

    auditService.logAudit({
      userId: req.user.id,
      action: 'EMAIL_SNOOZED',
      resourceType: 'Email',
      resourceId: email._id.toString(),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

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