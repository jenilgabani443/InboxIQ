'use strict';

const express = require('express');
const router = express.Router();
const securityController = require('./security.controller');
const authenticate = require('../../shared/middlewares/authenticate');
const asyncHandler = require('../../shared/utils/asyncHandler');

// Require authentication for all security routes
router.use(authenticate);

/**
 * @swagger
 * /security/alerts:
 *   get:
 *     tags:
 *       - Security
 *     summary: Retrieve security alerts for the authenticated user
 *     description: Returns a paginated list of security alerts, sorted with the newest first.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of records per page
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Filter for only unread alerts
 *     responses:
 *       200:
 *         description: Alerts retrieved successfully
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       type:
 *                         type: string
 *                       title:
 *                         type: string
 *                       message:
 *                         type: string
 *                       severity:
 *                         type: string
 *                       metadata:
 *                         type: object
 *                       isRead:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     totalPages:
 *                       type: number
 *             examples:
 *               success:
 *                 value:
 *                   success: true
 *                   message: "Security alerts retrieved"
 *                   data:
 *                     - _id: "6a47f7d9e1f54a001a1b2c3d"
 *                       type: "LOGIN_FAILED"
 *                       title: "Failed login attempt"
 *                       message: "A failed login attempt was detected."
 *                       severity: "HIGH"
 *                       isRead: false
 *                       createdAt: "2026-07-03T16:40:00.000Z"
 *                   meta:
 *                     total: 1
 *                     page: 1
 *                     limit: 20
 *                     totalPages: 1
 *       401:
 *         description: Unauthorized
 */
router.get('/alerts', asyncHandler(securityController.getAlerts));

/**
 * @swagger
 * /security/alerts/{id}/read:
 *   patch:
 *     tags:
 *       - Security
 *     summary: Mark a security alert as read
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alert marked as read
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
 *                   type: null
 *                 meta:
 *                   type: null
 *             examples:
 *               success:
 *                 value:
 *                   success: true
 *                   message: "Alert marked as read"
 *                   data: null
 *                   meta: null
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Alert not found
 */
router.patch('/alerts/:id/read', asyncHandler(securityController.markAsRead));

module.exports = router;
