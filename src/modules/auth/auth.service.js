'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { totp } = require('otplib');
const QRCode = require('qrcode');

const User = require('../user/user.model');
const { hashPassword, comparePassword } = require('../../shared/utils/hashUtils');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../../shared/utils/tokenUtils');
const { getRedisClient } = require('../../config/redis');
const ApiError = require('../../shared/utils/apiError');
const logger = require('../../shared/utils/logger');
const env = require('../../config/env');

/**
 * AuthService
 *
 * Handles all authentication business logic:
 * - Register, Login, Logout
 * - JWT token generation and rotation
 * - Refresh token management (Redis blacklist)
 * - Session management
 * - Password reset flow
 * - TOTP MFA
 */
class AuthService {
  /**
   * Registers a new user.
   * Checks for duplicate email, hashes password, creates user.
   *
   * @param {{ email, password, displayName }} data
   * @returns {{ user, accessToken, refreshToken }}
   */
  async register({ email, password, displayName }) {
    // Check for existing user
    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      throw ApiError.conflict('An account with this email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await User.create({
      email,
      passwordHash,
      displayName,
    });

    // Issue tokens
    const { accessToken, refreshToken, session } = await this._issueTokenPair(user);

    // Save session
    user.sessions.push(session);
    await user.save();

    logger.info('User registered:', { userId: user._id, email: user.email });

    return {
      user: user.toPublicProfile(),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Authenticates a user and returns token pair.
   * Supports MFA check if enabled.
   *
   * @param {{ email, password, totpCode, userAgent, ip }} data
   * @returns {{ user, accessToken, refreshToken }}
   */
  async login({ email, password, totpCode, userAgent, ip }) {
    // Find user with passwordHash (excluded by default)
    const user = await User.findOne({ email }).select('+passwordHash +mfaSecret');
    if (!user) {
      // Constant-time response to prevent email enumeration
      await comparePassword('dummy', '$2b$12$dummyhashtopreventtimingattacks00000000000000');
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      logger.warn('Failed login attempt:', { email });
      throw ApiError.unauthorized('Invalid email or password');
    }

    // MFA check
    if (user.mfaEnabled) {
      if (!totpCode) {
        throw ApiError.badRequest('MFA code required');
      }
      const isTotpValid = totp.verify({ token: totpCode, secret: user.mfaSecret });
      if (!isTotpValid) {
        throw ApiError.unauthorized('Invalid MFA code');
      }
    }

    // Issue tokens and save session
    const { accessToken, refreshToken, session } = await this._issueTokenPair(user, {
      userAgent,
      ip,
    });

    // Enforce max 5 sessions (remove oldest if exceeded)
    if (user.sessions.length >= 5) {
      user.sessions.sort((a, b) => a.lastActive - b.lastActive);
      user.sessions.shift();
    }
    user.sessions.push(session);
    await user.save();

    logger.info('User logged in:', { userId: user._id });

    return {
      user: user.toPublicProfile(),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Logs out a user by blacklisting their access token and removing the session.
   *
   * @param {{ accessToken, refreshToken, userId }} data
   */
  async logout({ accessToken, refreshToken, userId }) {
    const redis = getRedisClient();

    // Blacklist access token (expires with its own TTL)
    // TTL = remaining token lifetime
    const { decodeToken } = require('../../shared/utils/tokenUtils');
    const decoded = decodeToken(accessToken);
    if (decoded?.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redis.setex(`blacklist:${accessToken}`, ttl, '1');
      }
    }

    // Remove session containing this refresh token
    if (refreshToken && userId) {
      const user = await User.findById(userId);
      if (user) {
        // Remove matching session by comparing hashed refresh token
        const filteredSessions = [];
        for (const session of user.sessions) {
          const match = await comparePassword(refreshToken, session.refreshTokenHash);
          if (!match) filteredSessions.push(session);
        }
        user.sessions = filteredSessions;
        await user.save();
      }
    }

    logger.info('User logged out:', { userId });
  }

  /**
   * Rotates the refresh token.
   * Old refresh token is blacklisted; new pair is issued.
   *
   * @param {{ refreshToken, userAgent, ip }} data
   * @returns {{ accessToken, refreshToken }}
   */
  async refreshTokens({ refreshToken, userAgent, ip }) {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    // Verify session exists with matching refresh token hash
    let sessionIndex = -1;
    for (let i = 0; i < user.sessions.length; i += 1) {
      const match = await comparePassword(refreshToken, user.sessions[i].refreshTokenHash);
      if (match) {
        sessionIndex = i;
        break;
      }
    }

    if (sessionIndex === -1) {
      // Token reuse detected — possible token theft
      logger.warn('Refresh token reuse detected — clearing all sessions:', { userId: user._id });
      user.sessions = [];
      await user.save();
      throw ApiError.unauthorized('Refresh token invalid or already used. Please login again.');
    }

    // Issue new token pair
    const { accessToken: newAccessToken, refreshToken: newRefreshToken, session } = await this._issueTokenPair(user, {
      userAgent,
      ip,
    });

    // Replace old session with new
    user.sessions[sessionIndex] = session;
    await user.save();

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  /**
   * Initiates password reset flow.
   * Generates a signed reset token and stores its hash.
   * In v2, this sends an email via SMTP.
   *
   * @param {string} email
   * @returns {string} resetToken (returned in API for dev; emailed in prod)
   */
  async forgotPassword(email) {
    const user = await User.findOne({ email });
    // Always return success to prevent email enumeration
    if (!user) return null;

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    // TODO (v2): send email with reset link containing resetToken
    logger.info('Password reset initiated:', { userId: user._id });

    // Return token for dev/testing; in production, only send via email
    return env.NODE_ENV === 'development' ? resetToken : null;
  }

  /**
   * Resets user password with a valid reset token.
   *
   * @param {{ token, password }} data
   */
  async resetPassword({ token, password }) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw ApiError.badRequest('Reset token is invalid or has expired');
    }

    user.passwordHash = await hashPassword(password);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.sessions = []; // Invalidate all sessions on password change
    await user.save();

    logger.info('Password reset successful:', { userId: user._id });

    return { userId: user._id };
  }

  /**
   * Generates a TOTP secret and QR code URI for MFA setup.
   *
   * @param {string} userId
   * @returns {{ secret, qrCodeDataUrl }}
   */
  async enableMfa(userId) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    if (user.mfaEnabled) throw ApiError.conflict('MFA is already enabled');

    const secret = totp.generateSecret();
    const otpAuthUrl = totp.keyuri(user.email, env.APP_NAME, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Temporarily store secret (not yet activated) — activated after TOTP verify
    user.mfaSecret = secret;
    await user.save({ validateBeforeSave: false });

    return { secret, qrCodeDataUrl };
  }

  /**
   * Verifies TOTP code and activates MFA on the account.
   *
   * @param {{ userId, totpCode }} data
   */
  async verifyAndActivateMfa({ userId, totpCode }) {
    const user = await User.findById(userId).select('+mfaSecret');
    if (!user) throw ApiError.notFound('User not found');
    if (!user.mfaSecret) throw ApiError.badRequest('MFA setup not initiated');

    const isValid = totp.verify({ token: totpCode, secret: user.mfaSecret });
    if (!isValid) throw ApiError.unauthorized('Invalid TOTP code');

    user.mfaEnabled = true;
    await user.save();

    logger.info('MFA enabled:', { userId: user._id });
  }

  /**
   * Disables MFA on the account.
   *
   * @param {string} userId
   */
  async disableMfa(userId) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    await user.save();

    logger.info('MFA disabled:', { userId: user._id });
  }

  /**
   * Returns all active sessions for a user.
   *
   * @param {string} userId
   * @returns {Array} sessions
   */
  async getSessions(userId) {
    const user = await User.findById(userId).lean();
    if (!user) throw ApiError.notFound('User not found');

    return user.sessions.map((s) => ({
      id: s._id,
      deviceId: s.deviceId,
      userAgent: s.userAgent,
      ip: s.ip,
      lastActive: s.lastActive,
    }));
  }

  /**
   * Revokes a specific session by ID.
   *
   * @param {{ userId, sessionId }} data
   */
  async revokeSession({ userId, sessionId }) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    const sessionExists = user.sessions.some((s) => s._id.toString() === sessionId);
    if (!sessionExists) throw ApiError.notFound('Session not found');

    user.sessions = user.sessions.filter((s) => s._id.toString() !== sessionId);
    await user.save();

    logger.info('Session revoked:', { userId, sessionId });
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Issues an access + refresh token pair and builds a session record.
   *
   * @param {object} user
   * @param {{ userAgent, ip }} [meta]
   * @returns {{ accessToken, refreshToken, session }}
   */
  async _issueTokenPair(user, { userAgent = '', ip = '' } = {}) {
    const payload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const refreshTokenHash = await hashPassword(refreshToken);
    const deviceId = uuidv4();

    const session = {
      deviceId,
      userAgent,
      ip,
      lastActive: new Date(),
      refreshTokenHash,
    };

    return { accessToken, refreshToken, session };
  }
}

module.exports = new AuthService();
