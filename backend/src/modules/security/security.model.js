'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const securityAlertSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['LOGIN_FAILED', 'LOGIN_SUCCESS', 'PASSWORD_CHANGED', 'MFA_ENABLED', 'MFA_DISABLED'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

// Compound index for querying a user's alerts by newest first
securityAlertSchema.index({ userId: 1, createdAt: -1 });

const SecurityAlert = mongoose.model('SecurityAlert', securityAlertSchema);

module.exports = { SecurityAlert };
