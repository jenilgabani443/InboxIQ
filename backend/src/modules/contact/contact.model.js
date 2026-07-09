'use strict';

const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, trim: true, default: '' },
    avatarUrl: { type: String, default: null },
    emailCount: { type: Number, default: 1 }, // for autocomplete ranking
    lastContactedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

contactSchema.index({ userId: 1, email: 1 }, { unique: true });
contactSchema.index({ userId: 1, emailCount: -1 }); // for sorted autocomplete
// Phase 4: three-tier autocomplete ranking index — most contacted → most recent → alphabetical
contactSchema.index({ userId: 1, emailCount: -1, lastContactedAt: -1, name: 1 });

const Contact = mongoose.model('Contact', contactSchema);

module.exports = Contact;
