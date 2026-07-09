'use strict';

/**
 * Generates a human-readable summary for a thread based on its emails.
 * Version 1: Rule-based engine
 */
class SummaryEngine {
  /**
   * Extracts unique participant names from a list of emails.
   */
  static extractParticipants(emails) {
    const participantMap = new Map();
    
    const addContact = (contact) => {
      if (!contact || !contact.email) return;
      const emailLower = contact.email.toLowerCase().trim();
      
      // If we don't have this person yet, or we have them but without a name, update it
      if (!participantMap.has(emailLower) || (contact.name && contact.name.trim() !== '')) {
        participantMap.set(emailLower, contact.name && contact.name.trim() !== '' ? contact.name.trim() : emailLower);
      }
    };

    for (const email of emails) {
      addContact(email.from);
      if (Array.isArray(email.to)) email.to.forEach(addContact);
      if (Array.isArray(email.cc)) email.cc.forEach(addContact);
      if (Array.isArray(email.bcc)) email.bcc.forEach(addContact);
    }

    return Array.from(participantMap.values());
  }

  /**
   * Generates the deterministic summary text.
   */
  static generateSummaryText(subject, messageCount, participants, latestSender, latestSnippet) {
    let text = `Conversation about '${subject || 'No Subject'}' containing ${messageCount} message${messageCount === 1 ? '' : 's'}`;
    
    if (participants.length > 0) {
      if (participants.length === 1) {
        text += ` involving ${participants[0]}`;
      } else if (participants.length === 2) {
        text += ` between ${participants[0]} and ${participants[1]}`;
      } else {
        const last = participants.pop();
        text += ` between ${participants.join(', ')}, and ${last}`;
        participants.push(last); // restore array
      }
    }
    
    text += `.`;

    if (latestSender) {
      let cleanSnippet = (latestSnippet || 'No content provided').replace(/\n+/g, ' ').trim();
      if (cleanSnippet.length > 60) {
        cleanSnippet = cleanSnippet.slice(0, 57) + '...';
      }
      text += ` The latest update was sent by ${latestSender}. They wrote: "${cleanSnippet}"`;
    }

    return text;
  }
}

module.exports = SummaryEngine;
