'use strict';

/**
 * Gmail-Style Search Query Parser — Phase 4
 *
 * Parses a raw query string that may contain Gmail-style operators into a
 * structured object that the email service can convert into a MongoDB filter.
 *
 * Supported operators:
 *   from:user@example.com
 *   to:user@example.com
 *   cc:user@example.com
 *   bcc:user@example.com
 *   subject:meeting notes
 *   label:work
 *   has:attachment
 *   is:read
 *   is:unread
 *   before:YYYY-MM-DD
 *   after:YYYY-MM-DD
 *   in:inbox | in:sent | in:drafts | in:trash | in:spam | in:archive
 *
 * Multiple operators can be combined in a single query string.
 * Any remaining text after extracting operators becomes the free-text search term.
 *
 * Examples:
 *   'from:john@example.com subject:meeting has:attachment'
 *   'is:unread in:inbox after:2024-01-01'
 *   'hello world from:alice@example.com'   → textQuery='hello world'
 *
 * @param {string} rawQuery
 * @returns {{
 *   textQuery:    string|null,
 *   from:         string|null,
 *   to:           string|null,
 *   cc:           string|null,
 *   bcc:          string|null,
 *   subject:      string|null,
 *   label:        string|null,
 *   hasAttachment:boolean|null,
 *   isRead:       boolean|null,
 *   folder:       string|null,
 *   before:       string|null,
 *   after:        string|null,
 * }}
 */
const parseSearchQuery = (rawQuery) => {
  if (!rawQuery || typeof rawQuery !== 'string') {
    return _emptyResult();
  }

  const result = _emptyResult();
  let remaining = rawQuery.trim();

  // ── Operator token regex ───────────────────────────────────────────────────
  // Matches  key:value  OR  key:"quoted value"
  // The `in` operator is handled as a string key to avoid JS reserved-word issues.
  const TOKEN_RE = /(\w+):("([^"]+)"|([^\s]+))/g;

  const consumed = [];

  let match;
  while ((match = TOKEN_RE.exec(rawQuery)) !== null) {
    const operator = match[1].toLowerCase();
    const value = (match[3] || match[4] || '').trim(); // prefer quoted group

    // Tentatively mark as consumed; cases with invalid values will flip this to false.
    let tokenConsumed = true;

    switch (operator) {
      case 'from':
        result.from = value;
        break;

      case 'to':
        result.to = value;
        break;

      case 'cc':
        result.cc = value;
        break;

      case 'bcc':
        result.bcc = value;
        break;

      case 'subject':
        result.subject = value;
        break;

      case 'label':
        result.label = value;
        break;

      case 'has':
        if (value === 'attachment') {
          result.hasAttachment = true;
        } else {
          tokenConsumed = false; // unknown has: value — leave in free-text
        }
        break;

      case 'is':
        if (value === 'read') {
          result.isRead = true;
        } else if (value === 'unread') {
          result.isRead = false;
        } else {
          tokenConsumed = false; // unknown is: value — leave in free-text
        }
        break;

      case 'before':
        if (_isValidDate(value)) {
          result.before = value;
        } else {
          tokenConsumed = false; // invalid date — leave in free-text
        }
        break;

      case 'after':
        if (_isValidDate(value)) {
          result.after = value;
        } else {
          tokenConsumed = false; // invalid date — leave in free-text
        }
        break;

      case 'in': {
        const VALID_FOLDERS = ['inbox', 'sent', 'drafts', 'trash', 'spam', 'archive'];
        if (VALID_FOLDERS.includes(value.toLowerCase())) {
          result.folder = value.toLowerCase();
        } else {
          tokenConsumed = false; // unknown folder — leave in free-text
        }
        break;
      }

      // Completely unknown operator key — leave in free-text
      default:
        tokenConsumed = false;
        break;
    }

    if (tokenConsumed) {
      consumed.push(match[0]);
    }
  }


  // Remove all consumed operator tokens from the string to get free-text.
  // Use a global regex so every occurrence is removed (handles duplicate operators).
  // Escape regex metacharacters in the token (e.g. email addresses contain `.` and `+`).
  consumed.forEach((token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    remaining = remaining.replace(new RegExp(escaped, 'g'), '');
  });

  const freeText = remaining.replace(/\s+/g, ' ').trim();
  result.textQuery = freeText || null;

  return result;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const _emptyResult = () => ({
  textQuery: null,
  from: null,
  to: null,
  cc: null,
  bcc: null,
  subject: null,
  label: null,
  hasAttachment: null,
  isRead: null,
  folder: null,
  before: null,
  after: null,
});

/**
 * Validates that a string looks like a YYYY-MM-DD date.
 * Does not validate that the calendar date actually exists.
 *
 * @param {string} value
 * @returns {boolean}
 */
const _isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

module.exports = { parseSearchQuery };
