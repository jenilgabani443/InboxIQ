'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../../shared/middlewares/authenticate');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const ApiError = require('../../shared/utils/apiError');
const { paginate } = require('../../shared/utils/pagination');

const Notification = require('./notification.model');

router.use(authenticate);

/**
 * @swagger
 * /notifications:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: Get all notifications
 *     description: Retrieve paginated notifications for the authenticated user.
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *         description: Notifications retrieved successfully.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const query = {
      userId: req.user.id,
    };

    const total = await Notification.countDocuments(query);

    const {
      skip,
      limit: lim,
      meta,
    } = paginate({
      page,
      limit,
      total,
    });

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean();

    return ApiResponse.ok(
      res,
      'Notifications retrieved',
      notifications,
      meta,
    );
  }),
);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     tags:
 *       - Notifications
 *     summary: Mark notification as read
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Notification ID
 *         schema:
 *           type: string
 *         example: 686019e7b6d91c9f47f12211
 *     responses:
 *       200:
 *         description: Notification marked as read.
 */
router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id,
      },
      {
        isRead: true,
      },
      {
        new: true,
      },
    );

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    return ApiResponse.ok(
      res,
      'Notification marked as read',
    );
  }),
);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     tags:
 *       - Notifications
 *     summary: Mark all notifications as read
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read.
 */
router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await Notification.updateMany(
      {
        userId: req.user.id,
        isRead: false,
      },
      {
        isRead: true,
      },
    );

    return ApiResponse.ok(
      res,
      'All notifications marked as read',
    );
  }),
);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     tags:
 *       - Notifications
 *     summary: Delete notification
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Notification ID
 *         schema:
 *           type: string
 *         example: 686019e7b6d91c9f47f12211
 *     responses:
 *       200:
 *         description: Notification deleted successfully.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    return ApiResponse.ok(
      res,
      'Notification deleted',
    );
  }),
);

module.exports = router;