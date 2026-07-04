'use strict';

const auditService = require('../audit/audit.service');
const securityService = require('../security/security.service');

class ExportService {
  /**
   * Helper function to convert an array of objects to a CSV string.
   * @param {Array} data - Array of objects
   * @param {Array} columns - Array of keys to extract
   * @returns {string} CSV formatted string
   */
  _toCSV(data, columns) {
    if (!data || data.length === 0) {
      return columns.join(',') + '\n';
    }

    const header = columns.join(',');
    const rows = data.map(item => columns.map(col => {
        let val = item[col];
        if (val === null || val === undefined) val = '';
        
        // Escape quotes and wrap in quotes if there's a comma or newline
        val = String(val).replace(/"/g, '""');
        if (val.search(/("|,|\n)/g) >= 0) {
          val = `"${val}"`;
        }
        return val;
      }).join(','));

    return [header, ...rows].join('\n');
  }

  async exportAuditLogs(userId, { format = 'json', page = 1, limit = 1000, action } = {}) {
    // If format is CSV, we probably want a larger limit if one wasn't specified, but we'll stick to provided limit
    const result = await auditService.getTimeline(userId, { page, limit, action });
    
    if (format === 'csv') {
      const columns = ['createdAt', 'action', 'resourceType', 'resourceId'];
      const csv = this._toCSV(result.logs, columns);
      return { format: 'csv', data: csv };
    }

    return { format: 'json', data: result.logs };
  }

  async exportSecurityAlerts(userId, { format = 'json', page = 1, limit = 1000, unreadOnly } = {}) {
    const result = await securityService.getAlerts(userId, { page, limit, unreadOnly });
    
    if (format === 'csv') {
      const columns = ['createdAt', 'type', 'severity', 'title', 'message', 'isRead'];
      const csv = this._toCSV(result.alerts, columns);
      return { format: 'csv', data: csv };
    }

    return { format: 'json', data: result.alerts };
  }
}

module.exports = new ExportService();
