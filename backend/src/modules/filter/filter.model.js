'use strict';

const mongoose = require('mongoose');

const filterSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    conditions: {
      from: { type: String, default: null },
      to: { type: String, default: null },
      subject: { type: String, default: null },
      hasAttachment: { type: Boolean, default: null },
      bodyContains: { type: String, default: null },
    },
    actions: {
      applyLabel: { type: mongoose.Schema.Types.ObjectId, ref: 'Label', default: null },
      markRead: { type: Boolean, default: false },
      star: { type: Boolean, default: false },
      archive: { type: Boolean, default: false },
      deleteEmail: { type: Boolean, default: false },
      forwardTo: { type: String, default: null },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Filter = mongoose.model('Filter', filterSchema);

module.exports = Filter;
