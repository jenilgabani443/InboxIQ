'use strict';

const aiService = require('./ai.service');
const ApiResponse = require('../../shared/utils/apiResponse');
const auditService = require('../audit/audit.service');

class AIController {
  async getSmartReplies(req, res) {
    const { emailId } = req.params;
    const suggestions = await aiService.getSmartReplies(emailId);
    
    return ApiResponse.ok(res, 'Smart replies generated', {
      emailId,
      suggestions
    });
  }

  async getPriorityScore(req, res) {
    const { emailId } = req.params;
    const result = await aiService.calculatePriorityScore(emailId);
    
    auditService.logAudit({
      userId: req.user.id,
      action: 'AI_PRIORITY_CALCULATED',
      resourceType: 'Email',
      resourceId: emailId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    return ApiResponse.ok(res, 'Priority calculated', {
      emailId,
      priorityScore: result.priorityScore,
      priority: result.priority
    });
  }

  async autoLabelEmail(req, res) {
    const { emailId } = req.params;
    const userId = req.user.id;
    
    const result = await aiService.autoLabelEmail(emailId, userId);
    
    if (result.labels.length === 0) {
      return ApiResponse.ok(res, 'No labels matched', {
        emailId: result.emailId,
        labels: []
      });
    }

    auditService.logAudit({
      userId: req.user.id,
      action: 'AI_AUTO_LABEL',
      resourceType: 'Email',
      resourceId: emailId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    return ApiResponse.ok(res, 'Labels applied successfully', {
      emailId: result.emailId,
      labels: result.labels
    });
  }

  async getThreadSummary(req, res) {
    const { threadId } = req.params;
    const userId = req.user.id;
    
    const result = await aiService.getThreadSummary(threadId, userId);
    
    if (result.messageCount === 0) {
      return ApiResponse.ok(res, 'Thread is empty', {
        summary: result.summary
      });
    }

    auditService.logAudit({
      userId: req.user.id,
      action: 'AI_SUMMARY_GENERATED',
      resourceType: 'Thread',
      resourceId: threadId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    return ApiResponse.ok(res, 'Thread summary generated', result);
  }

  async checkUnsubscribe(req, res) {
    const { emailId } = req.params;
    const userId = req.user.id;

    const result = await aiService.checkUnsubscribe(emailId, userId);

    if (result.hasUnsubscribe) {
      return ApiResponse.ok(res, 'Unsubscribe option detected', result);
    }

    return ApiResponse.ok(res, 'No unsubscribe option detected', result);
  }
}

module.exports = new AIController();
