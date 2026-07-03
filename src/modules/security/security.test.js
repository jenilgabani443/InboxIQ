'use strict';

const mongoose = require('mongoose');
const request = require('supertest');
const appInit = require('../../app');
const { SecurityAlert } = require('./security.model');
const securityService = require('./security.service');
const { AuditLog } = require('../audit/audit.model');
const auditService = require('../audit/audit.service');

const API = '/api/v1';

let app;

beforeAll(() => {
  app = appInit();
});

const registerAndLogin = async (suffix) => {
  const user = {
    email: `security_${suffix}@inboxiq.app`,
    password: 'Test@1234!',
    displayName: `Security Test ${suffix}`,
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

describe('Phase 8 - Feature 3: Security Alerts', () => {
  let token;
  let userId;

  beforeAll(async () => {
    ({ accessToken: token, userId } = await registerAndLogin('secuser'));
  });

  beforeEach(async () => {
    await SecurityAlert.deleteMany({});
    await AuditLog.deleteMany({});
  });

  describe('Integration with Audit Logs', () => {
    it('should create a LOGIN_FAILED security alert', async () => {
      await auditService.logAudit({
        userId,
        action: 'LOGIN_FAILED',
        ip: '127.0.0.1',
        userAgent: 'jest'
      });

      const alerts = await SecurityAlert.find({ userId, type: 'LOGIN_FAILED' }).lean();
      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe('LOGIN_FAILED');
      expect(alerts[0].severity).toBe('HIGH');
    });

    it('should create a LOGIN_SUCCESS security alert only on new devices', async () => {
      // First login (new device)
      await auditService.logAudit({
        userId,
        action: 'LOGIN_SUCCESS',
        ip: '127.0.0.1',
        userAgent: 'jest'
      });

      let alerts = await SecurityAlert.find({ userId, type: 'LOGIN_SUCCESS' }).lean();
      expect(alerts.length).toBe(1);
      
      // Second login (same device)
      await auditService.logAudit({
        userId,
        action: 'LOGIN_SUCCESS',
        ip: '127.0.0.1',
        userAgent: 'jest'
      });

      alerts = await SecurityAlert.find({ userId, type: 'LOGIN_SUCCESS' }).lean();
      expect(alerts.length).toBe(1); // Should not increase
    });
    
    it('should create MFA_ENABLED security alert', async () => {
      await auditService.logAudit({
        userId,
        action: 'MFA_ENABLED',
        ip: '127.0.0.1',
        userAgent: 'jest'
      });

      const alerts = await SecurityAlert.find({ userId, type: 'MFA_ENABLED' }).lean();
      expect(alerts[0].type).toBe('MFA_ENABLED');
      expect(alerts[0].severity).toBe('MEDIUM');
    });
  });

  describe('GET /api/v1/security/alerts', () => {
    it('should return 401 if unauthorized', async () => {
      const res = await request(app).get(`${API}/security/alerts`);
      expect(res.status).toBe(401);
    });

    it('should return empty array if no alerts', async () => {
      const res = await request(app)
        .get(`${API}/security/alerts`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should return only current user alerts, order newest first', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const now = Date.now();

      await SecurityAlert.create([
        { userId: otherUserId, type: 'LOGIN_FAILED', title: 'test', message: 'test', severity: 'HIGH', createdAt: new Date(now + 1000) },
        { userId, type: 'MFA_DISABLED', title: 'test', message: 'test', severity: 'HIGH', createdAt: new Date(now - 10000) }, // Oldest
        { userId, type: 'PASSWORD_CHANGED', title: 'test', message: 'test', severity: 'HIGH', createdAt: new Date(now) }, // Newest
      ]);

      const res = await request(app)
        .get(`${API}/security/alerts`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2); // Only current user's
      
      // Newest first
      expect(res.body.data[0].type).toBe('PASSWORD_CHANGED');
      expect(res.body.data[1].type).toBe('MFA_DISABLED');
    });

    it('should support pagination correctly', async () => {
      const now = Date.now();
      await SecurityAlert.create([
        { userId, type: 'LOGIN_FAILED', title: 't', message: 'm', severity: 'LOW', createdAt: new Date(now - 3000) },
        { userId, type: 'LOGIN_SUCCESS', title: 't', message: 'm', severity: 'LOW', createdAt: new Date(now - 2000) },
        { userId, type: 'PASSWORD_CHANGED', title: 't', message: 'm', severity: 'LOW', createdAt: new Date(now - 1000) },
      ]);

      const res = await request(app)
        .get(`${API}/security/alerts?page=1&limit=2`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(3);
      expect(res.body.data[0].type).toBe('PASSWORD_CHANGED'); // newest first
      expect(res.body.data[1].type).toBe('LOGIN_SUCCESS');
    });

    it('should filter by unreadOnly correctly', async () => {
      const now = Date.now();
      await SecurityAlert.create([
        { userId, type: 'LOGIN_FAILED', title: 't', message: 'm', severity: 'LOW', createdAt: new Date(now - 3000), isRead: true },
        { userId, type: 'LOGIN_SUCCESS', title: 't', message: 'm', severity: 'LOW', createdAt: new Date(now - 2000), isRead: false },
        { userId, type: 'PASSWORD_CHANGED', title: 't', message: 'm', severity: 'LOW', createdAt: new Date(now - 1000), isRead: false },
      ]);

      const res = await request(app)
        .get(`${API}/security/alerts?unreadOnly=true`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.data[0].type).toBe('PASSWORD_CHANGED');
      expect(res.body.data[1].type).toBe('LOGIN_SUCCESS');
    });
  });

  describe('PATCH /api/v1/security/alerts/:id/read', () => {
    it('should mark an alert as read', async () => {
      const alert = await SecurityAlert.create({ userId, type: 'LOGIN_FAILED', title: 't', message: 'm', severity: 'LOW' });
      
      const res = await request(app)
        .patch(`${API}/security/alerts/${alert._id}/read`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Alert marked as read');

      const updated = await SecurityAlert.findById(alert._id);
      expect(updated.isRead).toBe(true);
    });

    it('should return 404 if marking another user alert', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const alert = await SecurityAlert.create({ userId: otherUserId, type: 'LOGIN_FAILED', title: 't', message: 'm', severity: 'LOW' });
      
      const res = await request(app)
        .patch(`${API}/security/alerts/${alert._id}/read`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(404);
    });
  });
});
