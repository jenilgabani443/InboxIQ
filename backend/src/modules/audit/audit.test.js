'use strict';

const mongoose = require('mongoose');
const request = require('supertest');
const appInit = require('../../app');
const { AuditLog } = require('./audit.model');
const auditService = require('./audit.service');

const API = '/api/v1';

let app;

beforeAll(() => {
  app = appInit();
});

const registerAndLogin = async (suffix) => {
  const user = {
    email: `audit_${suffix}@inboxiq.app`,
    password: 'Test@1234!',
    displayName: `Audit Test ${suffix}`,
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

describe('Phase 8 - Feature 1: Audit Logging', () => {
  let token;
  let userId;

  beforeAll(async () => {
    ({ accessToken: token, userId } = await registerAndLogin('audituser'));
  });

  beforeEach(async () => {
    await AuditLog.deleteMany({});
  });

  describe('Service implementation', () => {
    it('should create an audit log via the reusable service function', async () => {
      const res = await auditService.logAudit({
        userId,
        action: 'EMAIL_DELETED',
        resourceType: 'Email',
        resourceId: new mongoose.Types.ObjectId().toString(),
        metadata: { folder: 'trash' },
        ip: '127.0.0.1',
        userAgent: 'jest'
      });
      expect(res).toBeDefined();
      expect(res.action).toBe('EMAIL_DELETED');

      const log = await AuditLog.findById(res._id).lean();
      expect(log).toBeDefined();
      expect(log.metadata.folder).toBe('trash');
    });

    it('should not throw if missing fields, but return null', async () => {
      // Intentionally missing action
      const res = await auditService.logAudit({
        userId
      });
      expect(res).toBeNull();
    });
  });

  describe('GET /api/v1/audit', () => {
    it('should return 401 if unauthorized', async () => {
      const res = await request(app).get(`${API}/audit`);
      expect(res.status).toBe(401);
    });

    it('should return audit logs successfully with pagination and sorting', async () => {
      // Create 3 logs with mock timestamps to test sorting
      const now = Date.now();
      await AuditLog.create([
        {
          userId,
          action: 'LOGIN_SUCCESS',
          createdAt: new Date(now - 10000) // Oldest
        },
        {
          userId,
          action: 'EMAIL_DELETED',
          createdAt: new Date(now) // Newest
        },
        {
          userId,
          action: 'LOGOUT',
          createdAt: new Date(now - 5000) // Middle
        }
      ]);

      const res = await request(app)
        .get(`${API}/audit?page=1&limit=2`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(3);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.meta.totalPages).toBe(2);
      
      // Newest should be first
      expect(res.body.data[0].action).toBe('EMAIL_DELETED');
      expect(res.body.data[1].action).toBe('LOGOUT');

      // Page 2
      const res2 = await request(app)
        .get(`${API}/audit?page=2&limit=2`)
        .set('Authorization', `Bearer ${token}`);
      expect(res2.body.data.length).toBe(1);
      expect(res2.body.data[0].action).toBe('LOGIN_SUCCESS'); // Oldest
    });

    it('should have a TTL index on createdAt', async () => {
      const indexes = await AuditLog.collection.indexes();
      const ttlIndex = indexes.find(i => i.key.createdAt === 1 && i.expireAfterSeconds !== undefined);
      expect(ttlIndex).toBeDefined();
      expect(ttlIndex.expireAfterSeconds).toBe(90 * 24 * 60 * 60); // 90 days in seconds
    });
  });

  describe('GET /api/v1/audit/timeline', () => {
    it('should return 401 if unauthorized', async () => {
      const res = await request(app).get(`${API}/audit/timeline`);
      expect(res.status).toBe(401);
    });

    it('should return empty array if timeline is empty', async () => {
      const res = await request(app)
        .get(`${API}/audit/timeline`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('should return only current user logs, exclude ip/userAgent, and order newest first', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const now = Date.now();

      await AuditLog.create([
        { userId: otherUserId, action: 'EMAIL_SENT', createdAt: new Date(now + 1000) }, // Other user's log
        { userId, action: 'LOGIN_SUCCESS', createdAt: new Date(now - 10000), ip: '127.0.0.1' }, // Oldest
        { userId, action: 'EMAIL_ARCHIVED', createdAt: new Date(now), userAgent: 'jest' }, // Newest
      ]);

      const res = await request(app)
        .get(`${API}/audit/timeline`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2); // Only current user's logs
      
      // Newest first
      expect(res.body.data[0].action).toBe('EMAIL_ARCHIVED');
      expect(res.body.data[1].action).toBe('LOGIN_SUCCESS');

      // Sensitive data excluded
      expect(res.body.data[0].ip).toBeUndefined();
      expect(res.body.data[0].userAgent).toBeUndefined();
    });

    it('should support pagination correctly', async () => {
      const now = Date.now();
      await AuditLog.create([
        { userId, action: 'EMAIL_SENT', createdAt: new Date(now - 3000) },
        { userId, action: 'EMAIL_DELETED', createdAt: new Date(now - 2000) },
        { userId, action: 'EMAIL_ARCHIVED', createdAt: new Date(now - 1000) },
      ]);

      const res = await request(app)
        .get(`${API}/audit/timeline?page=1&limit=2`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(3);
      expect(res.body.data[0].action).toBe('EMAIL_ARCHIVED'); // newest first
      expect(res.body.data[1].action).toBe('EMAIL_DELETED');
    });

    it('should filter by action correctly', async () => {
      const now = Date.now();
      await AuditLog.create([
        { userId, action: 'AI_PRIORITY_CALCULATED', createdAt: new Date(now - 3000) },
        { userId, action: 'EMAIL_SENT', createdAt: new Date(now - 2000) },
        { userId, action: 'AI_PRIORITY_CALCULATED', createdAt: new Date(now - 1000) },
      ]);

      const res = await request(app)
        .get(`${API}/audit/timeline?action=AI_PRIORITY_CALCULATED`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].action).toBe('AI_PRIORITY_CALCULATED');
      expect(res.body.data[1].action).toBe('AI_PRIORITY_CALCULATED');
      expect(res.body.meta.total).toBe(2);
    });
  });
});
