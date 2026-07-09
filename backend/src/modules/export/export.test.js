'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const appInit = require('../../app');
const { AuditLog } = require('../audit/audit.model');
const { SecurityAlert } = require('../security/security.model');

const API = '/api/v1';

let app;

beforeAll(() => {
  app = appInit();
});

const registerAndLogin = async (suffix) => {
  const user = {
    email: `export_${suffix}@inboxiq.app`,
    password: 'Test@1234!',
    displayName: `Export Test ${suffix}`,
  };
  await request(app).post(`${API}/auth/register`).send(user);
  const loginRes = await request(app).post(`${API}/auth/login`).send({
    email: user.email,
    password: user.password,
  });
  return {
    accessToken: loginRes.body.data.accessToken,
    userId: loginRes.body.data.user.id,
  };
};

describe('Phase 8 - Feature 4: Export', () => {
  let token;
  let userId;

  beforeAll(async () => {
    ({ accessToken: token, userId } = await registerAndLogin('exportuser'));
  });

  beforeEach(async () => {
    await AuditLog.deleteMany({});
    await SecurityAlert.deleteMany({});
  });

  describe('GET /api/v1/export/audit', () => {
    it('should return 401 if unauthorized', async () => {
      const res = await request(app).get(`${API}/export/audit`);
      expect(res.status).toBe(401);
    });

    it('should export audit logs in JSON format (default)', async () => {
      await AuditLog.create([
        { userId, action: 'EMAIL_SENT', resourceType: 'Email', resourceId: '123' },
        { userId, action: 'EMAIL_DELETED', resourceType: 'Email', resourceId: '124' },
      ]);

      const res = await request(app)
        .get(`${API}/export/audit`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].action).toBe('EMAIL_DELETED'); // default is newest first
    });

    it('should export audit logs in CSV format with headers when empty', async () => {
      const res = await request(app)
        .get(`${API}/export/audit?format=csv`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename="audit_logs.csv"');
      expect(res.text.trim()).toBe('createdAt,action,resourceType,resourceId');
    });

    it('should export audit logs in CSV format', async () => {
      await AuditLog.create([
        { userId, action: 'EMAIL_SENT', resourceType: 'Email', resourceId: '123', createdAt: new Date('2023-01-01T00:00:00Z') },
      ]);

      const res = await request(app)
        .get(`${API}/export/audit?format=csv`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      const rows = res.text.trim().split('\n');
      expect(rows.length).toBe(2);
      expect(rows[0]).toBe('createdAt,action,resourceType,resourceId');
      expect(rows[1]).toContain('EMAIL_SENT,Email,123');
    });

    it('should only export authenticated user\'s data', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      await AuditLog.create([
        { userId, action: 'EMAIL_SENT', resourceType: 'Email' },
        { userId: otherUserId, action: 'EMAIL_DELETED', resourceType: 'Email' },
      ]);

      const res = await request(app)
        .get(`${API}/export/audit`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].action).toBe('EMAIL_SENT');
    });
  });

  describe('GET /api/v1/export/security', () => {
    it('should return 401 if unauthorized', async () => {
      const res = await request(app).get(`${API}/export/security`);
      expect(res.status).toBe(401);
    });

    it('should export security alerts in JSON format (default)', async () => {
      const now = Date.now();
      await SecurityAlert.create([
        { userId, type: 'LOGIN_FAILED', title: 'test', message: 'test msg', severity: 'HIGH', createdAt: new Date(now - 1000) },
        { userId, type: 'PASSWORD_CHANGED', title: 'test2', message: 'test msg2', severity: 'HIGH', createdAt: new Date(now) },
      ]);

      const res = await request(app)
        .get(`${API}/export/security`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].type).toBe('PASSWORD_CHANGED'); // newest first
    });

    it('should export security alerts in CSV format', async () => {
      await SecurityAlert.create([
        { userId, type: 'LOGIN_FAILED', title: 't', message: 'm,msg', severity: 'HIGH' },
      ]);

      const res = await request(app)
        .get(`${API}/export/security?format=csv`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename="security_alerts.csv"');
      
      const rows = res.text.trim().split('\n');
      expect(rows.length).toBe(2);
      expect(rows[0]).toBe('createdAt,type,severity,title,message,isRead');
      // The message "m,msg" should be wrapped in quotes because it contains a comma
      expect(rows[1]).toContain('LOGIN_FAILED,HIGH,t,"m,msg",false');
    });

    it('should handle missing fields safely in CSV', async () => {
      await SecurityAlert.create([
        { userId, type: 'LOGIN_FAILED', title: 't', message: 'm', severity: 'HIGH' },
      ]);

      const res = await request(app)
        .get(`${API}/export/security?format=csv`)
        .set('Authorization', `Bearer ${token}`);
      
      const rows = res.text.trim().split('\n');
      expect(rows[1]).toContain('LOGIN_FAILED'); // ensure no errors
    });
  });
});
