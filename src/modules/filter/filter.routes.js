'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../../shared/middlewares/authenticate');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const ApiError = require('../../shared/utils/apiError');

const Filter = require('./filter.model');

router.use(authenticate);

/**
 * @swagger
 * /filters:
 *   get:
 *     tags:
 *       - Filters
 *     summary: Get all filters
 *     description: Retrieve all filters created by the authenticated user.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Filters retrieved successfully.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = await Filter.find({
      userId: req.user.id,
    })
      .populate('actions.applyLabel', 'name color')
      .lean();

    return ApiResponse.ok(res, 'Filters retrieved', filters);
  }),
);

/**
 * @swagger
 * /filters:
 *   post:
 *     tags:
 *       - Filters
 *     summary: Create filter
 *     description: Create a new email filter.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             example:
 *               name: Work Emails
 *               conditions:
 *                 from: boss@example.com
 *               actions:
 *                 moveToFolder: inbox
 *     responses:
 *       201:
 *         description: Filter created successfully.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const filter = await Filter.create({
      ...req.body,
      userId: req.user.id,
    });

    return ApiResponse.created(res, 'Filter created', filter);
  }),
);

/**
 * @swagger
 * /filters/{id}:
 *   patch:
 *     tags:
 *       - Filters
 *     summary: Update filter
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Filter ID
 *         schema:
 *           type: string
 *         example: 686019e7b6d91c9f47f12211
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Filter updated successfully.
 */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const filter = await Filter.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id,
      },
      req.body,
      {
        new: true,
      },
    );

    if (!filter) {
      throw ApiError.notFound('Filter not found');
    }

    return ApiResponse.ok(res, 'Filter updated', filter);
  }),
);

/**
 * @swagger
 * /filters/{id}:
 *   delete:
 *     tags:
 *       - Filters
 *     summary: Delete filter
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Filter ID
 *         schema:
 *           type: string
 *         example: 686019e7b6d91c9f47f12211
 *     responses:
 *       200:
 *         description: Filter deleted successfully.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await Filter.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    return ApiResponse.ok(res, 'Filter deleted');
  }),
);

module.exports = router;