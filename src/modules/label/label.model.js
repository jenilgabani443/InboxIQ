'use strict';

const mongoose = require('mongoose');

const labelSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    color: { type: String, default: '#6366f1', match: /^#[0-9a-fA-F]{6}$/ },
    isSystem: { type: Boolean, default: false }, // true for Inbox, Sent, etc.
  },
  { timestamps: true },
);

labelSchema.index({ userId: 1, name: 1 }, { unique: true });

const Label = mongoose.model('Label', labelSchema);

module.exports = Label;
