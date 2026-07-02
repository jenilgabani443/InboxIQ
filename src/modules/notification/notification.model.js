'use strict';

const mongoose = require('mongoose');
const { NOTIFICATION_TYPE } = require('../../shared/constants/emailStatus');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPE),
      required: true,
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    referenceModel: { type: String, enum: ['Email', 'Thread'] },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
// TTL: auto-delete notifications older than 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
