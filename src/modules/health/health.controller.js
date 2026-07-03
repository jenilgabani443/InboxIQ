'use strict';

const healthService = require('./health.service');
const ApiResponse = require('../../shared/utils/apiResponse');

/**
 * @swagger
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Health check (Liveness)
 *     description: Verify that the API server is running.
 *     responses:
 *       200:
 *         description: Server is healthy.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: UP
 *                     timestamp:
 *                       type: string
 *                       example: 2026-07-04T10:30:00.000Z
 */
const getLiveness = (req, res) => {
  const data = healthService.getLiveness();
  return ApiResponse.ok(res, 'Service is healthy', data);
};

/**
 * @swagger
 * /health/ready:
 *   get:
 *     tags:
 *       - Health
 *     summary: Readiness check
 *     description: Detailed readiness information including database, memory, and environment.
 *     responses:
 *       200:
 *         description: Application is ready.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Service is ready
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: READY
 *                     database:
 *                       type: string
 *                       example: CONNECTED
 *                     uptime:
 *                       type: number
 *                       example: 12345
 *                     environment:
 *                       type: string
 *                       example: development
 *                     nodeVersion:
 *                       type: string
 *                       example: v22.x.x
 *                     memory:
 *                       type: object
 *                       properties:
 *                         rss:
 *                           type: number
 *                           example: 12345678
 *                         heapUsed:
 *                           type: number
 *                           example: 4567890
 *                         heapTotal:
 *                           type: number
 *                           example: 9876543
 *                         external:
 *                           type: number
 *                           example: 123456
 *                     timestamp:
 *                       type: string
 *                       example: 2026-07-04T10:30:00.000Z
 */
const getReadiness = (req, res) => {
  const data = healthService.getReadiness();
  return ApiResponse.ok(res, 'Service is ready', data);
};

module.exports = {
  getLiveness,
  getReadiness
};
