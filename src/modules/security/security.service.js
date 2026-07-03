'use strict';

const { SecurityAlert } = require('./security.model');
const logger = require('../../shared/utils/logger');

class SecurityService {
  /**
   * Creates a security alert for a user.
   */
  async createAlert({ userId, type, title, message, severity, metadata }) {
    try {
      const alert = new SecurityAlert({
        userId,
        type,
        title,
        message,
        severity,
        metadata: metadata || {},
      });
      return await alert.save();
    } catch (error) {
      logger.error(`Failed to create security alert for ${type}`, { error: error.message, userId });
      return null;
    }
  }

  /**
   * Retrieves security alerts for a given user.
   */
  async getAlerts(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    const skip = (page - 1) * limit;
    const query = { userId };
    
    if (unreadOnly === 'true' || unreadOnly === true) {
      query.isRead = false;
    }

    const [alerts, total] = await Promise.all([
      SecurityAlert.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      SecurityAlert.countDocuments(query)
    ]);

    return {
      alerts,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Marks a specific alert as read.
   */
  async markAsRead(alertId, userId) {
    const alert = await SecurityAlert.findOneAndUpdate(
      { _id: alertId, userId },
      { isRead: true },
      { new: true }
    );
    return alert;
  }
}

module.exports = new SecurityService();
