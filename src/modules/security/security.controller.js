'use strict';

const securityService = require('./security.service');
const ApiResponse = require('../../shared/utils/apiResponse');
const ApiError = require('../../shared/utils/apiError');

class SecurityController {
  async getAlerts(req, res) {
    const userId = req.user.id;
    const { page, limit, unreadOnly } = req.query;

    const result = await securityService.getAlerts(userId, { page, limit, unreadOnly });

    return ApiResponse.ok(res, 'Security alerts retrieved', result.alerts, result.pagination);
  }

  async markAsRead(req, res) {
    const userId = req.user.id;
    const alertId = req.params.id;

    const alert = await securityService.markAsRead(alertId, userId);
    
    if (!alert) {
      throw ApiError.notFound('Alert not found');
    }

    return ApiResponse.ok(res, 'Alert marked as read');
  }
}

module.exports = new SecurityController();
