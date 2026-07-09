'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../../shared/middlewares/authenticate');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const ApiError = require('../../shared/utils/apiError');

const Label = require('./label.model');

router.use(authenticate);

/**
 * @swagger
 * /labels:
 *   get:
 *     summary: Get all labels
 *     description: Retrieve all labels for the authenticated user.
 *     tags:
 *       - Labels
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Labels retrieved successfully.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const labels = await Label.find({ userId: req.user.id })
      .sort({ name: 1 })
      .lean();

    return ApiResponse.ok(res, 'Labels retrieved', labels);
  }),
);

/**
 * @swagger
 * /labels:
 *   post:
 *     summary: Create a label
 *     description: Create a new custom label.
 *     tags:
 *       - Labels
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - color
 *             properties:
 *               name:
 *                 type: string
 *                 example: Work
 *               color:
 *                 type: string
 *                 example: "#4285F4"
 *     responses:
 *       201:
 *         description: Label created successfully.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, color } = req.body;

    const label = await Label.create({
      userId: req.user.id,
      name,
      color,
    });

    return ApiResponse.created(res, 'Label created', label);
  }),
);

/**
 * @swagger
 * /labels/{id}:
 *   patch:
 *     summary: Update a label
 *     description: Update an existing custom label.
 *     tags:
 *       - Labels
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Label ID
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
 *               name:
 *                 type: string
 *                 example: Personal
 *               color:
 *                 type: string
 *                 example: "#34A853"
 *     responses:
 *       200:
 *         description: Label updated successfully.
 *       404:
 *         description: Label not found.
 */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const label = await Label.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id,
      },
      req.body,
      {
        new: true,
      },
    );

    if (!label) {
      throw ApiError.notFound('Label not found');
    }

    return ApiResponse.ok(res, 'Label updated', label);
  }),
);

/**
 * @swagger
 * /labels/{id}:
 *   delete:
 *     summary: Delete a label
 *     description: Delete a custom label. System labels cannot be deleted.
 *     tags:
 *       - Labels
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Label ID
 *         schema:
 *           type: string
 *         example: 6a41687065033b0ee4a7d63c
 *     responses:
 *       200:
 *         description: Label deleted successfully.
 *       404:
 *         description: Label not found.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const label = await Label.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
      isSystem: false,
    });

    if (!label) {
      throw ApiError.notFound(
        'Label not found or is a system label',
      );
    }

    return ApiResponse.ok(res, 'Label deleted');
  }),
);

module.exports = router;