'use strict';

const authService = require('./auth.service');
const ApiResponse = require('../../shared/utils/apiResponse');
const asyncHandler = require('../../shared/utils/asyncHandler');

/**
 * Auth Controller
 * Handles HTTP request/response lifecycle only.
 * All business logic is delegated to AuthService.
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user account
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, displayName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Min 8 chars, 1 uppercase, 1 number, 1 special char
 *               displayName:
 *                 type: string
 *                 minLength: 2
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: Email already exists
 *       422:
 *         description: Validation error
 */
const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return ApiResponse.created(res, 'Account created successfully', result);
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and receive JWT token pair
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               totpCode:
 *                 type: string
 *                 description: Required if MFA is enabled
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
const login = asyncHandler(async (req, res) => {
  const { email, password, totpCode } = req.body;
  const result = await authService.login({
    email,
    password,
    totpCode,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  return ApiResponse.ok(res, 'Login successful', result);
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh token and issue new access token
 *     security: []
 */
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const tokens = await authService.refreshTokens({
    refreshToken,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  return ApiResponse.ok(res, 'Tokens refreshed', tokens);
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and invalidate tokens
 */
const logout = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.split(' ')[1];
  const { refreshToken } = req.body;

  await authService.logout({
    accessToken,
    refreshToken,
    userId: req.user.id,
  });
  return ApiResponse.ok(res, 'Logged out successfully');
});

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Initiate password reset flow
 *     security: []
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const resetToken = await authService.forgotPassword(req.body.email);
  const data = resetToken ? { resetToken } : null; // only in dev
  return ApiResponse.ok(res, 'If this email is registered, a reset link has been sent.', data);
});

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password with signed token
 *     security: []
 */
const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  return ApiResponse.ok(res, 'Password reset successful. Please login with your new password.');
});

/**
 * @swagger
 * /auth/mfa/enable:
 *   post:
 *     tags: [Auth]
 *     summary: Generate TOTP secret and QR code for MFA setup
 */
const enableMfa = asyncHandler(async (req, res) => {
  const result = await authService.enableMfa(req.user.id);
  return ApiResponse.ok(res, 'Scan the QR code with your authenticator app, then verify.', result);
});

/**
 * @swagger
 * /auth/mfa/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Verify TOTP code to activate MFA
 */
const verifyMfa = asyncHandler(async (req, res) => {
  await authService.verifyAndActivateMfa({ userId: req.user.id, totpCode: req.body.totpCode });
  return ApiResponse.ok(res, 'MFA enabled successfully');
});

/**
 * @swagger
 * /auth/mfa/disable:
 *   post:
 *     tags: [Auth]
 *     summary: Disable MFA on account
 */
const disableMfa = asyncHandler(async (req, res) => {
  await authService.disableMfa(req.user.id);
  return ApiResponse.ok(res, 'MFA disabled successfully');
});

/**
 * @swagger
 * /auth/sessions:
 *   get:
 *     tags: [Auth]
 *     summary: List all active sessions
 */
const getSessions = asyncHandler(async (req, res) => {
  const sessions = await authService.getSessions(req.user.id);
  return ApiResponse.ok(res, 'Sessions retrieved', sessions);
});

/**
 * @swagger
 * /auth/sessions/{sessionId}:
 *   delete:
 *     tags: [Auth]
 *     summary: Revoke a device session
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 */
const revokeSession = asyncHandler(async (req, res) => {
  await authService.revokeSession({ userId: req.user.id, sessionId: req.params.sessionId });
  return ApiResponse.ok(res, 'Session revoked successfully');
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  enableMfa,
  verifyMfa,
  disableMfa,
  getSessions,
  revokeSession,
};
