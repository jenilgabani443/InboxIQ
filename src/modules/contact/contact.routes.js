'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../../shared/middlewares/authenticate');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const ApiError = require('../../shared/utils/apiError');

const Contact = require('./contact.model');

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
 *     description: Search contacts by name or email.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         example: jen
 *     responses:
 *       200:
 *         description: Matching contacts.
 */
router.get(
  '/autocomplete',
  asyncHandler(async (req, res) => {
    const { q } = req.query;

    if (!q || q.length < 1) {
      return ApiResponse.ok(res, 'Results', []);
    }

    const contacts = await Contact.find({
      userId: req.user.id,
      $or: [
        {
          email: {
            $regex: q,
            $options: 'i',
          },
        },
        {
          name: {
            $regex: q,
            $options: 'i',
          },
        },
      ],
    })
      .sort({ emailCount: -1 })
      .limit(10)
      .select('email name avatarUrl')
      .lean();

    return ApiResponse.ok(
      res,
      'Autocomplete results',
      contacts,
    );
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
 */
router.post(
  '/',
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
 */
router.patch(
  '/:id',
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
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await Contact.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    return ApiResponse.ok(res, 'Contact deleted');
  }),
);

module.exports = router;