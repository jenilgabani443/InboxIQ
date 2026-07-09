'use strict';

const request = require('supertest');
const createApp = require('../../app');
const { AuditLog } = require('../audit/audit.model');
const { SecurityAlert } = require('../security/security.model');

let app;

beforeAll(() => {
  app = createApp();
});

describe('Auth API — Integration Tests', () => {
  const testUser = {
    email: 'test@inboxiq.app',
    password: 'Test@1234!',
    displayName: 'Test User',
  };

  let accessToken;
  let refreshToken;

  // ── Register ─────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(testUser);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user.email).toBe(testUser.email);
    });

    it('should reject duplicate email', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(testUser);
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should reject weak password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'other@inboxiq.app',
        password: 'weak',
        displayName: 'Test',
      });
      expect(res.status).toBe(422);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject invalid email format', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'not-an-email',
        password: 'Test@1234!',
        displayName: 'Test',
      });
      expect(res.status).toBe(422);
    });
  });

  // ── Login ─────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');

      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('should reject invalid password and create LOGIN_FAILED audit and alert', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testUser.email,
        password: 'WrongPassword!1',
      });
      expect(res.status).toBe(401);

      // Check Audit Log
      const audit = await AuditLog.findOne({ action: 'LOGIN_FAILED' }).sort({ createdAt: -1 }).lean();
      expect(audit).not.toBeNull();
      // user.email could be mapped to userId via db query but we'll assume it exists if it's the latest

      // Check Security Alert
      const alert = await SecurityAlert.findOne({ type: 'LOGIN_FAILED' }).sort({ createdAt: -1 }).lean();
      expect(alert).not.toBeNull();
      expect(alert.userId.toString()).toBe(audit.userId.toString());
    });

    it('should reject non-existent email', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'nobody@inboxiq.app',
        password: 'Test@1234!',
      });
      expect(res.status).toBe(401);
    });
  });

  // ── Protected Route ───────────────────────────────────────────────────────
  describe('GET /api/v1/users/me', () => {
    it('should return user profile with valid access token', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(testUser.email);
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/v1/users/me');
      expect(res.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });
  });

  // ── Token Refresh ─────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/refresh', () => {
    it('should issue new token pair with valid refresh token', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: 'invalid' });
      expect(res.status).toBe(401);
    });
  });

  // ── Health ────────────────────────────────────────────────────────────────
  describe('GET /api/v1/health', () => {
    it('should return 200 ok', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UP');
    });
  });
});
