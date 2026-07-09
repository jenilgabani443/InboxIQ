'use strict';
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
require('dotenv').config();

const http = require('http');
const createApp = require('./app');
const { connectDB } = require('./config/db');
const { connectRedis } = require('./config/redis');
const { initSocket } = require('./config/socket');
const { verifyCloudinaryConfig } = require('./config/cloudinary');
const { startWorkers } = require('./modules/jobs/job.worker');
const { closeQueues } = require('./config/queue');
const logger = require('./shared/utils/logger');
const env = require('./config/env');

/**
 * Application Bootstrap.
 *
 * Boot sequence:
 * 1. Connect to Redis (required for auth, rate-limiting, queues)
 * 2. Connect to MongoDB
 * 3. Verify Cloudinary credentials
 * 4. Create Express app
 * 5. Create HTTP server (wraps Express for Socket.IO compatibility)
 * 6. Initialize Socket.IO on HTTP server
 * 7. Start listening
 *
 * Unhandled rejections and uncaught exceptions are caught globally.
 * In production, a process manager (PM2 / ECS) will restart the process.
 */
const bootstrap = async () => {
  try {
    logger.info('✅ Environment configuration loaded successfully');

    // 1. Connect to Redis
    await connectRedis();

    // 2. Connect to MongoDB
    await connectDB();

    // 3. Verify Cloudinary
    await verifyCloudinaryConfig();

    // 4. Create Express app
    const app = createApp();

    // 5. Create HTTP server
    const httpServer = http.createServer(app);

    // 6. Initialize Socket.IO
    initSocket(httpServer);

    // 7. Start Bull queue workers
    startWorkers();

    // 8. Start listening
    httpServer.listen(env.PORT, () => {
      logger.info(`🚀 InboxIQ API running on port ${env.PORT}`);
      logger.info(`📚 Swagger UI: http://localhost:${env.PORT}/api-docs`);
      logger.info(`🌍 Environment: ${env.NODE_ENV}`);
    });

    // ── Graceful Shutdown ───────────────────────────────────────────────────
    const shutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      httpServer.close(async () => {
        logger.info('HTTP server closed');

        const { disconnectDB } = require('./config/db');
        const { disconnectRedis } = require('./config/redis');

        await closeQueues();
        await disconnectDB();
        await disconnectRedis();

        logger.info('Graceful shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 30s
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Fatal error during bootstrap:', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

// ── Global Error Catchers ─────────────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason, promise });
  // Don't exit — let process manager handle restarts in production
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  process.exit(1); // Uncaught exceptions leave app in unknown state; must exit
});

bootstrap();
