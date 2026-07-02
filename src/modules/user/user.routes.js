'use strict';

/**
 * User routes stub.
 * Full implementation in Phase 1.
 */
const express = require('express');
const router = express.Router();
const authenticate = require('../../shared/middlewares/authenticate');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const User = require('./user.model');
const validate = require('../../shared/middlewares/validate');
const {
  updateProfileSchema,
  changePasswordSchema,
  updateSignatureSchema,
  updateVacationSchema,
  updatePreferencesSchema,
} = require('../auth/auth.validator');
const { hashPassword, comparePassword } = require('../../shared/utils/hashUtils');
const ApiError = require('../../shared/utils/apiError');
/**
 * @swagger
 * /users/me:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get current user profile
 *     description: Returns the authenticated user's profile.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw ApiError.notFound('User not found');
    return ApiResponse.ok(res, 'Profile retrieved', user.toPublicProfile());
  }),
);
/**
 * @swagger
 * /users/me:
 *   patch:
 *     tags:
 *       - Users
 *     summary: Update current user profile
 *     description: Update display name, avatar and profile information.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 */
router.patch(
  '/me',
  authenticate,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.user.id, req.body, { new: true, runValidators: true });
    return ApiResponse.ok(res, 'Profile updated', user.toPublicProfile());
  }),
);
/**
 * @swagger
 * /users/me/password:
 *   put:
 *     tags:
 *       - Users
 *     summary: Change password
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.put(
  '/me/password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('+passwordHash');
    const isValid = await comparePassword(req.body.currentPassword, user.passwordHash);
    if (!isValid) throw ApiError.unauthorized('Current password is incorrect');
    user.passwordHash = await hashPassword(req.body.newPassword);
    await user.save();
    return ApiResponse.ok(res, 'Password changed successfully');
  }),
);
/**
 * @swagger
 * /users/me/signature:
 *   put:
 *     tags:
 *       - Users
 *     summary: Update email signature
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signature
 *             properties:
 *               signature:
 *                 type: string
 *                 example: "Best Regards,\nJenil Gabani"
 *     responses:
 *       200:
 *         description: Signature updated successfully
 *       401:
 *         description: Unauthorized
 */
router.put(
  '/me/signature',
  authenticate,
  validate(updateSignatureSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.user.id, { signature: req.body.signature }, { new: true });
    return ApiResponse.ok(res, 'Signature updated', { signature: user.signature });
  }),
);
/**
 * @swagger
 * /users/me/vacation:
 *   put:
 *     tags:
 *       - Users
 *     summary: Update vacation responder
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 example: true
 *               subject:
 *                 type: string
 *                 example: Out of Office
 *               body:
 *                 type: string
 *                 example: I am on vacation. I will reply when I return.
 *     responses:
 *       200:
 *         description: Vacation responder updated
 */
router.put(
  '/me/vacation',
  authenticate,
  validate(updateVacationSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.user.id, { vacationResponder: req.body }, { new: true });
    return ApiResponse.ok(res, 'Vacation responder updated', { vacationResponder: user.vacationResponder });
  }),
);
/**
 * @swagger
 * /users/me/preferences:
 *   put:
 *     tags:
 *       - Users
 *     summary: Update user preferences
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               theme:
 *                 type: string
 *                 example: dark
 *               undoSendSeconds:
 *                 type: integer
 *                 example: 10
 *               notificationsEnabled:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *       401:
 *         description: Unauthorized
 */
router.put(
  '/me/preferences',
  authenticate,
  validate(updatePreferencesSchema),
  asyncHandler(async (req, res) => {
    const updates = {};
    Object.entries(req.body).forEach(([k, v]) => {
      updates[`preferences.${k}`] = v;
    });
    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true });
    return ApiResponse.ok(res, 'Preferences updated', { preferences: user.preferences });
  }),
);
/**
 * @swagger
 * /users/me:
 *   delete:
 *     tags:
 *       - Users
 *     summary: Delete current account
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Account scheduled for deletion
 */
router.delete(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user.id, { deletedAt: new Date() });
    return ApiResponse.ok(res, 'Account deleted. Your data will be removed within 30 days.');
  }),
);

module.exports = router;
