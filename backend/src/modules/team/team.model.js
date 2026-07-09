'use strict';

const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // We intentionally omit CRUD APIs for teams as per Phase 6 minimal scope.
    // This model exists solely to provide a valid ObjectId reference for Users, Emails, and Threads.
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Team = mongoose.models.Team || mongoose.model('Team', teamSchema);

module.exports = Team;
