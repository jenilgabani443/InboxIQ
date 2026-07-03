'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const appInit = require('../../app');

const API = '/api/v1';

let app;

beforeAll(() => {
  app = appInit();
});

describe('Phase 8 - Feature 5: Health & Readiness Monitoring', () => {
  describe('GET /api/v1/health', () => {
    it('should return HTTP 200', async () => {
      const res = await request(app).get(`${API}/health`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Service is healthy');
      expect(res.body.data).toBeDefined();
    });

    it('should contain status UP and timestamp', async () => {
      const res = await request(app).get(`${API}/health`);
      expect(res.body.data.status).toBe('UP');
      expect(res.body.data.timestamp).toBeDefined();
    });
  });

  describe('GET /api/v1/health/ready', () => {
    it('should return HTTP 200', async () => {
      const res = await request(app).get(`${API}/health/ready`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Service is ready');
    });

    it('should contain database field', async () => {
      const res = await request(app).get(`${API}/health/ready`);
      expect(res.body.data.database).toBe('CONNECTED'); // In tests, mongoose is connected
    });

    it('should contain memory object with required fields', async () => {
      const res = await request(app).get(`${API}/health/ready`);
      const mem = res.body.data.memory;
      expect(mem).toBeDefined();
      expect(mem.rss).toBeDefined();
      expect(mem.heapUsed).toBeDefined();
      expect(mem.heapTotal).toBeDefined();
      expect(mem.external).toBeDefined();
    });

    it('should contain uptime', async () => {
      const res = await request(app).get(`${API}/health/ready`);
      expect(res.body.data.uptime).toBeDefined();
      expect(typeof res.body.data.uptime).toBe('number');
    });

    it('should contain nodeVersion', async () => {
      const res = await request(app).get(`${API}/health/ready`);
      expect(res.body.data.nodeVersion).toBeDefined();
      expect(res.body.data.nodeVersion).toContain('v');
    });

    it('should contain environment', async () => {
      const res = await request(app).get(`${API}/health/ready`);
      expect(res.body.data.environment).toBeDefined();
      expect(['test', 'development', 'production']).toContain(res.body.data.environment);
    });

    it('should contain timestamp', async () => {
      const res = await request(app).get(`${API}/health/ready`);
      expect(res.body.data.timestamp).toBeDefined();
    });
    
    it('should reflect Mongo disconnected state', async () => {
      const originalReadyState = mongoose.connection.readyState;
      // Mock the readyState
      Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true, writable: true });

      const res = await request(app).get(`${API}/health/ready`);
      expect(res.body.data.database).toBe('DISCONNECTED');
      
      // Restore
      Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true, writable: true });
    });
  });
});
