'use strict';

const Email = require('../email/email.model');
const Label = require('../label/label.model');
const Thread = require('../thread/thread.model');
const ApiError = require('../../shared/utils/apiError');
const { AI_KEYWORDS, LABEL_RULES, buildRegex } = require('./ai.rules');
const SummaryEngine = require('./summary.engine');

class AIService {
  async getSmartReplies(emailId) {
    const email = await Email.findById(emailId).lean();
    if (!email) {
      throw ApiError.notFound('Email not found');
    }

    const content = (email.bodyText || email.snippet || email.subject || '').toLowerCase();
    
    if (buildRegex(AI_KEYWORDS.MEETING).test(content)) {
      return [
        "Sounds good. I'll be there.",
        "That time works for me.",
        "I'll confirm shortly."
      ];
    }

    if (buildRegex(AI_KEYWORDS.THANKS).test(content)) {
      return [
        "You're welcome!",
        "Happy to help.",
        "Glad I could assist."
      ];
    }

    if (buildRegex(AI_KEYWORDS.INVOICE).test(content)) {
      return [
        "I'll review the invoice and get back to you.",
        "Thank you. I'll process this shortly.",
        "Received. I'll confirm once completed."
      ];
    }

    if (buildRegex(AI_KEYWORDS.APPROVAL).test(content)) {
      return [
        "I'll review and respond soon.",
        "Thanks. I'll take a look.",
        "I'll get back to you shortly."
      ];
    }

    if (buildRegex(AI_KEYWORDS.URGENT).test(content)) {
      return [
        "Acknowledged. I'll prioritize this.",
        "I'll look into this immediately.",
        "Thanks for letting me know."
      ];
    }

    return [
      "Thanks! I'll review this shortly.",
      "Received. I'll get back to you soon.",
      "Sounds good. I'll respond as soon as possible."
    ];
  }

  async calculatePriorityScore(emailId) {
    const email = await Email.findById(emailId).populate('labels').exec();
    if (!email) {
      throw ApiError.notFound('Email not found');
    }

    let score = 50;

    // 1. Subject keywords
    if (email.subject && buildRegex(AI_KEYWORDS.URGENT).test(email.subject)) {
      score += 20;
    }

    // 2. Sender
    const importantSenders = ['boss@inboxiq.app', 'admin@inboxiq.app', 'important@example.com'];
    if (email.from && email.from.email && importantSenders.includes(email.from.email.toLowerCase())) {
      score += 10;
    }

    // 3. Attachments
    if (email.attachments && email.attachments.length > 0) {
      score += 10;
    }

    // 4. Read status
    if (email.isRead) {
      score -= 10;
    } else {
      score += 10;
    }

    // 5. Recency
    const now = Date.now();
    const emailDate = new Date(email.createdAt || Date.now()).getTime();
    const hoursSince = (now - emailDate) / (1000 * 60 * 60);

    if (hoursSince < 24) {
      score += 10;
    } else if (hoursSince > 7 * 24) {
      score -= 10;
    }

    // 6. Labels
    if (email.labels && email.labels.some(l => l.name && l.name.toLowerCase() === 'urgent')) {
      score += 10;
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // Store the score
    email.priorityScore = score;
    await email.save();

    let priority = 'Low';
    if (score >= 71) {
      priority = 'High';
    } else if (score >= 31) {
      priority = 'Medium';
    }

    return { priorityScore: score, priority };
  }

  async autoLabelEmail(emailId, userId) {
    const email = await Email.findById(emailId).populate('labels').exec();
    if (!email) {
      throw ApiError.notFound('Email not found');
    }

    if (email.from.userId.toString() !== userId.toString()) {
      throw ApiError.forbidden('Access denied');
    }

    const content = `${email.subject || ''} ${email.bodyText || ''} ${email.snippet || ''}`.toLowerCase();
    const matchedRuleNames = [];

    // 1. Determine matching labels
    for (const rule of LABEL_RULES) {
      if (buildRegex(rule.keywords).test(content)) {
        matchedRuleNames.push(rule.name);
      }
    }

    if (matchedRuleNames.length === 0) {
      return { emailId, labels: email.labels || [] };
    }

    // 2. Add labels to email, creating missing labels if necessary
    const finalLabels = [...(email.labels || [])];
    let isUpdated = false;

    for (const ruleName of matchedRuleNames) {
      // Avoid duplicate labels on the email
      const alreadyHas = finalLabels.find(l => l.name === ruleName);
      if (alreadyHas) continue;

      const rule = LABEL_RULES.find(r => r.name === ruleName);

      // Check if the label exists in the DB for this user
      let labelDoc = await Label.findOne({ userId, name: ruleName });

      if (!labelDoc) {
        labelDoc = await Label.create({
          userId,
          name: ruleName,
          color: rule.color,
          isSystem: false,
        });
      }

      finalLabels.push(labelDoc);
      isUpdated = true;
    }

    // 3. Save the email if labels were added
    if (isUpdated) {
      email.labels = finalLabels.map(l => l._id);
      await email.save();
    }

    return { emailId, labels: finalLabels };
  }

  async getThreadSummary(threadId, userId) {
    const thread = await Thread.findById(threadId).lean();
    if (!thread) {
      throw ApiError.notFound('Thread not found');
    }

    // Check authorization: participant check
    const isParticipant = thread.participants.some(id => id.toString() === userId.toString());
    if (!isParticipant) {
      throw ApiError.forbidden('Access denied');
    }

    const emails = await Email.find({ threadId, isDeleted: false })
      .sort({ createdAt: 1 })
      .lean();

    if (emails.length === 0) {
      return {
        threadId,
        subject: thread.subject,
        summary: "No messages found.",
        participants: [],
        messageCount: 0,
        latestSender: null,
        latestActivity: null
      };
    }

    const participants = SummaryEngine.extractParticipants(emails);
    
    // Sort logic already gives us the oldest to newest
    const latestEmail = emails[emails.length - 1];
    
    const latestSender = (latestEmail.from && latestEmail.from.name) 
      ? latestEmail.from.name.trim() 
      : (latestEmail.from ? latestEmail.from.email : 'Unknown Sender');
      
    const latestSnippet = latestEmail.snippet || latestEmail.bodyText || latestEmail.subject || '';
    
    const summary = SummaryEngine.generateSummaryText(
      thread.subject,
      emails.length,
      participants,
      latestSender,
      latestSnippet
    );

    return {
      threadId,
      subject: thread.subject,
      summary,
      participants,
      messageCount: emails.length,
      latestSender,
      latestActivity: latestEmail.createdAt || latestEmail.sentAt
    };
  }

  async checkUnsubscribe(emailId, userId) {
    const email = await Email.findById(emailId).lean();
    if (!email) {
      throw ApiError.notFound('Email not found');
    }

    if (email.from.userId.toString() !== userId.toString()) {
      throw ApiError.forbidden('Access denied');
    }

    // 1. Header detection
    const headers = email.headers || {};
    const hasHeader = Object.keys(headers).some(key => key.toLowerCase() === 'list-unsubscribe');
    
    if (hasHeader) {
      return {
        emailId,
        hasUnsubscribe: true,
        detectedFrom: 'header',
        reason: 'List-Unsubscribe header detected.'
      };
    }

    // 2. Body detection
    const content = `${email.subject || ''} ${email.bodyText || ''} ${email.bodyHtml || ''} ${email.snippet || ''}`.toLowerCase();
    
    // Use the keyword mapping
    const regex = buildRegex(AI_KEYWORDS.UNSUBSCRIBE);
    const match = content.match(regex);
    
    if (match) {
      return {
        emailId,
        hasUnsubscribe: true,
        detectedFrom: 'body',
        reason: `Keyword '${match[0]}' found in email body.`
      };
    }

    return {
      emailId,
      hasUnsubscribe: false,
      detectedFrom: null,
      reason: null
    };
  }
}

module.exports = new AIService();
