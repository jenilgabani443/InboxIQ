'use strict';

const mongoose = require('mongoose');
const { hashPassword, comparePassword } = require('../../shared/utils/hashUtils');

/**
 * User Schema
 *
 * Design decisions:
 * - passwordHash stored separately from plain password (never stored)
 * - sessions array embedded (max 5) — avoids a separate sessions collection for v1
 * - signature and vacationResponder kept on the user document (1:1 relationship)
 * - deletedAt for soft delete (GDPR compliance — data retained but inactive)
 * - mfaSecret should be encrypted at rest in production (future: field-level encryption)
 */
const sessionSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true },
    userAgent: { type: String },
    ip: { type: String },
    lastActive: { type: Date, default: Date.now },
    refreshTokenHash: { type: String, required: true }, // bcrypt hash of refresh token
  },
  { _id: true },
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never returned in queries by default
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false,
    },
    signature: {
      type: String,
      default: '',
      maxlength: 10000,
    },
    vacationResponder: {
      enabled: { type: Boolean, default: false },
      subject: { type: String, default: '' },
      body: { type: String, default: '' },
      startDate: { type: Date },
      endDate: { type: Date },
    },
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark'],
        default: 'light',
      },
      undoSendSeconds: {
        type: Number,
        enum: [5, 10, 20, 30],
        default: 10,
      },
      notificationsEnabled: {
        type: Boolean,
        default: true,
      },
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    sessions: {
      type: [sessionSchema],
      default: [],
      validate: {
        validator: (v) => v.length <= 5,
        message: 'Maximum 5 active sessions allowed',
      },
    },
    // Password reset
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    // Email verification
    emailVerificationToken: { type: String, select: false },
    // Soft delete
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────────

userSchema.index({ deletedAt: 1 }, { sparse: true });

// ── Virtual: isDeleted ─────────────────────────────────────────────────────────
userSchema.virtual('isDeleted').get(function () {
  return this.deletedAt !== null;
});

// ── Instance Methods ───────────────────────────────────────────────────────────

/**
 * Verifies a plain password against the stored hash.
 * Requires selecting passwordHash field explicitly.
 */
userSchema.methods.verifyPassword = async function (password) {
  return comparePassword(password, this.passwordHash);
};

/**
 * Returns a safe public profile (strips sensitive fields).
 */
userSchema.methods.toPublicProfile = function () {
  return {
    id: this._id,
    email: this.email,
    displayName: this.displayName,
    avatarUrl: this.avatarUrl,
    role: this.role,
    isVerified: this.isVerified,
    mfaEnabled: this.mfaEnabled,
    signature: this.signature,
    vacationResponder: this.vacationResponder,
    preferences: this.preferences,
    createdAt: this.createdAt,
  };
};

// ── Pre-save Hook ──────────────────────────────────────────────────────────────
// Passwords are hashed in the service layer before saving to keep the model thin.
// We use hashUtils.hashPassword() in AuthService rather than a pre-save hook to:
// 1. Avoid hashing on every save() call (e.g., profile updates)
// 2. Keep business logic out of the model

// ── Soft Delete Query Helper ───────────────────────────────────────────────────
userSchema.pre(/^find/, function (next) {
  // Automatically exclude soft-deleted users unless explicitly including them
  if (!this.getQuery().deletedAt) {
    this.where({ deletedAt: null });
  }
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
