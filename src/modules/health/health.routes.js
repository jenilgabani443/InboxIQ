'use strict';

const express = require('express');
const router = express.Router();

const { mongoose } = require('../../config/db');
const { getRedisClient } = require('../../config/redis');

/**
 * @swagger
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Health check
 *     description: Verify that the API server is running.
 *     responses:
 *       200:
 *         description: Server is healthy.
 */
router.get('/', (_req, res) => {
    return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});

/**
 * @swagger
 * /health/ready:
 *   get:
 *     tags:
 *       - Health
 *     summary: Readiness check
 *     description: Verify that MongoDB and Redis are connected.
 *     responses:
 *       200:
 *         description: Application is ready.
 *       503:
 *         description: One or more required services are unavailable.
 */
router.get('/ready', async (_req, res) => {
    const mongoReady = mongoose.connection.readyState === 1;

    let redisReady = false;

    try {
        const redis = getRedisClient();

        await redis.ping();
        redisReady = true;
    } catch (err) {
        redisReady = false;
    }

    const checks = {
        mongodb: mongoReady ? 'ok' : 'error',
        redis: redisReady ? 'ok' : 'error',
    };

    if (!mongoReady || !redisReady) {
        return res.status(503).json({
            status: 'not ready',
            checks,
            timestamp: new Date().toISOString(),
        });
    }

    return res.status(200).json({
        status: 'ready',
        checks,
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;