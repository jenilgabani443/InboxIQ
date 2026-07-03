'use strict';

const { AuditLog } = require('./audit.model');
const logger = require('../../shared/utils/logger');

class AuditService {
  /**
   * Reusable function to create an audit log.
   * Handles errors internally to prevent breaking the main flow if audit logging fails.
   */
  async logAudit({
    userId,
    action,
    resourceType,
    resourceId,
    metadata,
    ip,
    userAgent
  }) {
    try {
      if (!userId || !action) {
        logger.warn('AuditLog requires userId and action');
        return null;
      }

      const logEntry = new AuditLog({
        userId,
        action,
        resourceType,
        resourceId,
        metadata: metadata || {},
        ip,
        userAgent
      });

      const savedLog = await logEntry.save();

      // Automatically create security alerts for relevant events
      try {
        const securityService = require('../security/security.service');
        
        if (action === 'LOGIN_FAILED') {
          await securityService.createAlert({
            userId,
            type: 'LOGIN_FAILED',
            title: 'Failed login attempt',
            message: 'A failed login attempt was detected.',
            severity: 'HIGH',
            metadata: { ip, userAgent, ...metadata }
          });
        } else if (action === 'PASSWORD_CHANGED') {
          await securityService.createAlert({
            userId,
            type: 'PASSWORD_CHANGED',
            title: 'Password changed',
            message: 'Your account password was recently changed.',
            severity: 'HIGH',
            metadata: { ip, userAgent, ...metadata }
          });
        } else if (action === 'MFA_ENABLED') {
          await securityService.createAlert({
            userId,
            type: 'MFA_ENABLED',
            title: 'MFA Enabled',
            message: 'Multi-factor authentication was enabled on your account.',
            severity: 'MEDIUM',
            metadata: { ip, userAgent, ...metadata }
          });
        } else if (action === 'MFA_DISABLED') {
          await securityService.createAlert({
            userId,
            type: 'MFA_DISABLED',
            title: 'MFA Disabled',
            message: 'Multi-factor authentication was disabled on your account.',
            severity: 'HIGH',
            metadata: { ip, userAgent, ...metadata }
          });
        } else if (action === 'LOGIN_SUCCESS') {
          // Check for new device
          const previousLogins = await AuditLog.countDocuments({
            userId,
            action: 'LOGIN_SUCCESS',
            userAgent,
            _id: { $ne: savedLog._id }
          });
          
          if (previousLogins === 0) {
            await securityService.createAlert({
              userId,
              type: 'LOGIN_SUCCESS',
              title: 'New login detected',
              message: 'A successful login was detected from a new device or browser.',
              severity: 'MEDIUM',
              metadata: { ip, userAgent, ...metadata }
            });
          }
        }
      } catch (secErr) {
        logger.error('Failed to dispatch security alert from audit hook', { error: secErr.message, userId });
      }

      return savedLog;
    } catch (error) {
      logger.error(`Failed to create audit log for action: ${action}`, { error: error.message, userId });
      // We explicitly don't throw to avoid disrupting the primary business operation
      return null;
    }
  }

  /**
   * Retrieves audit logs for a given user with pagination.
   */
  async getAuditLogs(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find({ userId })
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      AuditLog.countDocuments({ userId })
    ]);

    return {
      logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Retrieves timeline events for a user with pagination, optional action filtering,
   * and excludes sensitive data (ip, userAgent).
   */
  async getTimeline(userId, { page = 1, limit = 20, action } = {}) {
    const skip = (page - 1) * limit;
    const query = { userId };
    if (action) {
      query.action = action;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .select('-ip -userAgent -userId -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    return {
      logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = new AuditService();
