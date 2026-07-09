'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../../shared/middlewares/authenticate');
const validate = require('../../shared/middlewares/validate');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const ApiError = require('../../shared/utils/apiError');

const Contact = require('./contact.model');
const {
  autocompleteSchema,
  createContactSchema,
  updateContactSchema,
  deleteContactSchema,
} = require('./contact.validator');

router.use(authenticate);

/**
 * @swagger
 * /contacts:
 *   get:
 *     tags:
 *       - Contacts
 *     summary: Get all contacts
 *     description: Retrieve all contacts of the authenticated user.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Contacts retrieved successfully.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const contacts = await Contact.find({
      userId: req.user.id,
    })
      .sort({ emailCount: -1 })
      .lean();

    return ApiResponse.ok(res, 'Contacts retrieved', contacts);
  }),
);

/**
 * @swagger
 * /contacts/autocomplete:
 *   get:
 *     tags:
 *       - Contacts
 *     summary: Contact autocomplete
 *     description: |
 *       Search contacts by name or email prefix.
 *       Results are ranked in three tiers:
 *       1. **Most contacted** — highest `emailCount` first
 *       2. **Most recent** — highest `lastContactedAt` second
 *       3. **Alphabetical** — `name` ascending as final tiebreaker
 *
 *       Maximum 10 results are returned.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         description: Search prefix matched against both name and email (case-insensitive)
 *         example: jen
 *     responses:
 *       200:
 *         description: Matching contacts returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: Autocomplete results
 *               data:
 *                 - name: Jenil Gabani
 *                   email: jenil@example.com
 *                   avatarUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg"
 *                 - name: Jenny Smith
 *                   email: jenny@example.com
 *                   avatarUrl: null
 *               meta: null
 *               errors: null
 *               timestamp: "2024-06-01T10:00:00.000Z"
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error — q is required and must be 1-100 characters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: Validation failed
 *               errors:
 *                 - field: q
 *                   message: Search query must be at least 1 character
 *                   code: too_small
 *       500:
 *         description: Internal server error
 */
router.get(
  '/autocomplete',
  validate(autocompleteSchema),
  asyncHandler(async (req, res) => {
    const { q } = req.query;

    const contacts = await Contact.find({
      userId: req.user.id,
      $or: [
        { email: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
      ],
    })
      // Three-tier ranking:
      // 1. Most contacted (emailCount DESC)
      // 2. Most recent    (lastContactedAt DESC)
      // 3. Alphabetical   (name ASC)
      .sort({ emailCount: -1, lastContactedAt: -1, name: 1 })
      .limit(10)
      .select('email name avatarUrl -_id')
      .lean();

    return ApiResponse.ok(res, 'Autocomplete results', contacts);
  }),
);
/**
 * @swagger
 * /contacts:
 *   post:
 *     tags:
 *       - Contacts
 *     summary: Create or update a contact
 *     description: Saves a contact or updates it if it already exists.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               name:
 *                 type: string
 *                 example: John Doe
 *               avatarUrl:
 *                 type: string
 *                 example: https://example.com/avatar.png
 *     responses:
 *       201:
 *         description: Contact saved successfully.
 *       422:
 *         description: Validation error.
 */
router.post(
  '/',
  validate(createContactSchema),
  asyncHandler(async (req, res) => {
    const { email, name, avatarUrl } = req.body;

    const contact = await Contact.findOneAndUpdate(
      {
        userId: req.user.id,
        email,
      },
      {
        name,
        avatarUrl,
        $inc: {
          emailCount: 1,
        },
        lastContactedAt: new Date(),
      },
      {
        upsert: true,
        new: true,
      },
    );

    return ApiResponse.created(res, 'Contact saved', contact);
  }),
);

/**
 * @swagger
 * /contacts/{id}:
 *   patch:
 *     tags:
 *       - Contacts
 *     summary: Update contact
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 686019e7b6d91c9f47f12211
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Smith
 *               avatarUrl:
 *                 type: string
 *                 example: https://example.com/avatar.png
 *     responses:
 *       200:
 *         description: Contact updated successfully.
 *       404:
 *         description: Contact not found.
 *       422:
 *         description: Validation error.
 */
router.patch(
  '/:id',
  validate(updateContactSchema),
  asyncHandler(async (req, res) => {
    const contact = await Contact.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id,
      },
      req.body,
      {
        new: true,
      },
    );

    if (!contact) {
      throw ApiError.notFound('Contact not found');
    }

    return ApiResponse.ok(res, 'Contact updated', contact);
  }),
);
/**
 * @swagger
 * /contacts/{id}:
 *   delete:
 *     tags:
 *       - Contacts
 *     summary: Delete contact
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 686019e7b6d91c9f47f12211
 *     responses:
 *       200:
 *         description: Contact deleted successfully.
 *       404:
 *         description: Contact not found.
 */
router.delete(
  '/:id',
  validate(deleteContactSchema),
  asyncHandler(async (req, res) => {
    await Contact.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    return ApiResponse.ok(res, 'Contact deleted');
  }),
);

module.exports = router;