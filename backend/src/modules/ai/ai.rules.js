'use strict';

const AI_KEYWORDS = {
  INVOICE: ['invoice', 'payment', 'receipt', 'billing'],
  MEETING: ['meeting', 'schedule', 'calendar', 'zoom', 'call', 'tomorrow'],
  URGENT: ['urgent', 'asap', 'immediately', 'critical'],
  NEWSLETTER: ['newsletter', 'unsubscribe', 'promotion', 'marketing'],
  SUPPORT: ['support', 'ticket', 'issue', 'bug', 'help'],
  THANKS: ['thanks', 'thank you', 'appreciate'],
  APPROVAL: ['approve', 'approval', 'review'],
  UNSUBSCRIBE: ['unsubscribe', 'opt out', 'manage preferences', 'email preferences', 'remove me', 'stop receiving', 'stop emails', 'cancel subscription'],
};

const LABEL_RULES = [
  { name: 'Invoice', color: '#10B981', keywords: AI_KEYWORDS.INVOICE },
  { name: 'Meeting', color: '#3B82F6', keywords: AI_KEYWORDS.MEETING },
  { name: 'Urgent', color: '#EF4444', keywords: AI_KEYWORDS.URGENT },
  { name: 'Newsletter', color: '#8B5CF6', keywords: AI_KEYWORDS.NEWSLETTER },
  { name: 'Support', color: '#F59E0B', keywords: AI_KEYWORDS.SUPPORT },
];

/**
 * Helper to build a regex for a list of keywords.
 * Note: Not using word boundaries for backward compatibility with existing tests
 * which might test partial matches or specific combinations without \b.
 */
const buildRegex = (keywords) => new RegExp(`(${keywords.join('|')})`, 'i');

module.exports = {
  AI_KEYWORDS,
  LABEL_RULES,
  buildRegex,
};
