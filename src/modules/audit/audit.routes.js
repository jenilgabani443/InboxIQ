'use strict';

const express = require('express');
const router = express.Router();
const auditController = require('./audit.controller');
const authenticate = require('../../shared/middlewares/authenticate');
const asyncHandler = require('../../shared/utils/asyncHandler');

// Require authentication for all audit routes
router.use(authenticate);

/**
 * @swagger
 * /audit:
 *   get:
 *     tags:
 *       - Audit
 *     summary: Retrieve audit logs for the authenticated user
 *     description: Returns a paginated list of audit logs, sorted with the newest logs first.
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
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
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
 *                       action:
 *                         type: string
 *                       resourceType:
 *                         type: string
 *                       resourceId:
 *                         type: string
 *                       metadata:
 *                         type: object
 *                       ip:
 *                         type: string
 *                       userAgent:
 *                         type: string
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
 *                   message: "Audit logs retrieved"
 *                   data:
 *                     - _id: "6a47f7d9e1f54a001a1b2c3d"
 *                       userId: "6a47f05638b0bc983816ecfb"
 *                       action: "EMAIL_DELETED"
 *                       resourceType: "Email"
 *                       resourceId: "6a47f8e8b2f14a001a1b2c4f"
 *                       metadata:
 *                         folder: "trash"
 *                       ip: "127.0.0.1"
 *                       userAgent: "Mozilla/5.0"
 *                       createdAt: "2026-07-03T16:40:00.000Z"
 *                   meta:
 *                     total: 1
 *                     page: 1
 *                     limit: 20
 *                     totalPages: 1
 *       401:
 *         description: Unauthorized
 */
router.get('/', asyncHandler(auditController.getAuditLogs));

/**
 * @swagger
 * /audit/timeline:
 *   get:
 *     tags:
 *       - Audit
 *     summary: Retrieve the user's activity timeline
 *     description: Returns a paginated list of audit logs for the authenticated user, excluding sensitive data like IP and User Agent.
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
 *         name: action
 *         schema:
 *           type: string
 *         description: Optional action filter (e.g. EMAIL_SENT)
 *     responses:
 *       200:
 *         description: Timeline retrieved successfully
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
 *                       action:
 *                         type: string
 *                       resourceType:
 *                         type: string
 *                       resourceId:
 *                         type: string
 *                       metadata:
 *                         type: object
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
 *       401:
 *         description: Unauthorized
 */
router.get('/timeline', asyncHandler(auditController.getTimeline));

module.exports = router;
