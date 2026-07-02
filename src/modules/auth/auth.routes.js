'use strict';

const express = require('express');
const router = express.Router();

const controller = require('./auth.controller');
const validate = require('../../shared/middlewares/validate');
const authenticate = require('../../shared/middlewares/authenticate');
const { authLimiter } = require('../../shared/middlewares/rateLimiter');

const {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyMfaSchema,
  revokeSessionSchema,
} = require('./auth.validator');

// ── Public routes (no auth required) ──────────────────────────────────────────
router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshTokenSchema), controller.refresh);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), controller.resetPassword);

// ── Protected routes (auth required) ──────────────────────────────────────────
router.post('/logout', authenticate, controller.logout);
router.post('/mfa/enable', authenticate, controller.enableMfa);
router.post('/mfa/verify', authenticate, validate(verifyMfaSchema), controller.verifyMfa);
router.post('/mfa/disable', authenticate, controller.disableMfa);
router.get('/sessions', authenticate, controller.getSessions);
router.delete('/sessions/:sessionId', authenticate, validate(revokeSessionSchema), controller.revokeSession);

module.exports = router;
