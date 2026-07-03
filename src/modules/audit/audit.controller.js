'use strict';

const auditService = require('./audit.service');
const ApiResponse = require('../../shared/utils/apiResponse');

class AuditController {
  async getAuditLogs(req, res) {
    const userId = req.user.id;
    const { page, limit } = req.query;

    const result = await auditService.getAuditLogs(userId, { page, limit });

    return ApiResponse.ok(res, 'Audit logs retrieved', result.logs, result.pagination);
  }

  async getTimeline(req, res) {
    const userId = req.user.id;
    const { page, limit, action } = req.query;

    const result = await auditService.getTimeline(userId, { page, limit, action });

    return ApiResponse.ok(res, 'Timeline retrieved', result.logs, result.pagination);
  }
}

module.exports = new AuditController();
