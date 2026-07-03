'use strict';

const exportService = require('./export.service');
const ApiResponse = require('../../shared/utils/apiResponse');
const asyncHandler = require('../../shared/utils/asyncHandler');

/**
 * @swagger
 * /export/audit:
 *   get:
 *     tags: [Export]
 *     summary: Export user audit logs
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Format of the export
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by audit action
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
 *           default: 1000
 *         description: Number of items to return
 *     responses:
 *       200:
 *         description: Export successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 */
const exportAudit = asyncHandler(async (req, res) => {
  const result = await exportService.exportAuditLogs(req.user.id, req.query);

  if (result.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
    return res.status(200).send(result.data);
  }

  return ApiResponse.ok(res, 'Audit logs exported', result.data);
});

/**
 * @swagger
 * /export/security:
 *   get:
 *     tags: [Export]
 *     summary: Export user security alerts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Format of the export
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *         description: Filter for only unread alerts
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
 *           default: 1000
 *         description: Number of items to return
 *     responses:
 *       200:
 *         description: Export successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 */
const exportSecurity = asyncHandler(async (req, res) => {
  const result = await exportService.exportSecurityAlerts(req.user.id, req.query);

  if (result.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="security_alerts.csv"');
    return res.status(200).send(result.data);
  }

  return ApiResponse.ok(res, 'Security alerts exported', result.data);
});

module.exports = {
  exportAudit,
  exportSecurity,
};
