'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');

const env = require('./config/env');
const requestLogger = require('./shared/middlewares/requestLogger');
const errorHandler = require('./shared/middlewares/errorHandler');
const { globalLimiter } = require('./shared/middlewares/rateLimiter');
const ApiError = require('./shared/utils/apiError');
const { setupSwagger } = require('./docs/swagger');

// ── Module routes ──────────────────────────────────────────────────────────
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/user/user.routes');
const emailRoutes = require('./modules/email/email.routes');
const threadRoutes = require('./modules/thread/thread.routes');
const labelRoutes = require('./modules/label/label.routes');
const attachmentRoutes = require('./modules/attachment/attachment.routes');
const contactRoutes = require('./modules/contact/contact.routes');
const filterRoutes = require('./modules/filter/filter.routes');
const notificationRoutes = require('./modules/notification/notification.routes');
const aiRoutes = require('./modules/ai/ai.routes');
const healthRoutes = require('./modules/health/health.routes');
const searchRoutes = require('./modules/search/search.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const securityRoutes = require('./modules/security/security.routes');
const exportRoutes = require('./modules/export/export.routes');

/**
 * Express Application Factory.
 *
 * Exported separately from server.js so it can be imported in tests
 * without starting the HTTP server or attaching Socket.IO.
 *
 * Middleware order matters:
 * 1. Security headers (Helmet)
 * 2. CORS
 * 3. Compression
 * 4. Request parsing
 * 5. Sanitization
 * 6. Logging
 * 7. Rate limiting
 * 8. Routes
 * 9. 404 handler
 * 10. Global error handler (MUST be last)
 */
const createApp = () => {
  const app = express();

  // ── Security Headers ────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'res.cloudinary.com'],
        },
      },
    }),
  );

  // ── CORS ─────────────────────────────────────────────────────────────────
  const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
  //console.log('CORS_ORIGINS =', env.CORS_ORIGINS);
  // console.log('allowedOrigins =', allowedOrigins);
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new ApiError(403, `CORS policy: origin ${origin} not allowed`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // ── Compression ───────────────────────────────────────────────────────────
  app.use(compression());

  // ── Body Parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // ── NoSQL Injection Sanitization ──────────────────────────────────────────
  app.use(mongoSanitize());

  // ── HTTP Request Logging ──────────────────────────────────────────────────
  app.use(requestLogger);

  // ── Global Rate Limiting ──────────────────────────────────────────────────
  app.use(`/api/${env.API_VERSION}`, globalLimiter);

  // ── API Documentation ─────────────────────────────────────────────────────
  setupSwagger(app);

  // ── API Routes ────────────────────────────────────────────────────────────
  const apiRouter = express.Router();

  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/users', userRoutes);
  apiRouter.use('/emails', emailRoutes);
  apiRouter.use('/threads', threadRoutes);
  apiRouter.use('/labels', labelRoutes);
  apiRouter.use('/attachments', attachmentRoutes);
  apiRouter.use('/contacts', contactRoutes);
  apiRouter.use('/filters', filterRoutes);
  apiRouter.use('/notifications', notificationRoutes);
  apiRouter.use('/ai', aiRoutes);
  apiRouter.use('/health', healthRoutes);
  apiRouter.use('/search', searchRoutes);
  apiRouter.use('/audit', auditRoutes);
  apiRouter.use('/security', securityRoutes);
  apiRouter.use('/export', exportRoutes);
  app.use(`/api/${env.API_VERSION}`, apiRouter);

  // ── 404 Handler ───────────────────────────────────────────────────────────
  app.use((req, _res, next) => {
    next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // ── Global Error Handler (MUST be last) ───────────────────────────────────
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
