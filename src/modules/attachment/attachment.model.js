'use strict';

const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    emailId: { type: mongoose.Schema.Types.ObjectId, ref: 'Email', index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    cloudinaryPublicId: { type: String, required: true },
    cloudinaryUrl: { type: String, required: true },
    isInline: { type: Boolean, default: false },
    contentId: { type: String, default: null }, // CID for inline images
  },
  { timestamps: true },
);

const Attachment = mongoose.model('Attachment', attachmentSchema);

module.exports = Attachment;
