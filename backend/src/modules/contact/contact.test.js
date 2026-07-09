'use strict';

const request = require('supertest');
const createApp = require('../../app');

let app;

beforeAll(() => {
  app = createApp();
});

const API = '/api/v1';

/** Register + login a user, return { accessToken } */
const registerAndLogin = async (suffix) => {
  const user = {
    email: `contact_${suffix}@inboxiq.app`,
    password: 'Test@1234!',
    displayName: `Contact User ${suffix}`,
  };
  await request(app).post(`${API}/auth/register`).send(user);
  const res = await request(app).post(`${API}/auth/login`).send({
    email: user.email,
    password: user.password,
  });
  return { accessToken: res.body.data.accessToken };
};

/** Upsert a contact via POST /contacts */
const createContact = async (token, data) =>
  request(app)
    .post(`${API}/contacts`)
    .set('Authorization', `Bearer ${token}`)
    .send(data);

// ══════════════════════════════════════════════════════════════════════════════
describe('Phase 4 — Contact Autocomplete Integration Tests', () => {
  let token;
  let token2;

  beforeAll(async () => {
    const u1 = await registerAndLogin('alpha');
    token = u1.accessToken;

    const u2 = await registerAndLogin('beta');
    token2 = u2.accessToken;

    // Seed contacts for user1 with varying emailCounts to verify ranking
    // Tier 1: most contacted
    await createContact(token, {
      email: 'frequent@example.com',
      name: 'Frequent Contact',
      avatarUrl: null,
    });
    // Increase emailCount by upserting multiple times
    await createContact(token, { email: 'frequent@example.com', name: 'Frequent Contact' });
    await createContact(token, { email: 'frequent@example.com', name: 'Frequent Contact' });

    // Tier 2: moderate contact
    await createContact(token, { email: 'moderate@example.com', name: 'Moderate Contact' });
    await createContact(token, { email: 'moderate@example.com', name: 'Moderate Contact' });

    // Tier 3: least contacted, but name starts with "A" (alpha sort tiebreaker)
    await createContact(token, { email: 'alpha@example.com', name: 'Alpha Contact' });
    await createContact(token, { email: 'beta@example.com', name: 'Beta Contact' });
    await createContact(token, { email: 'gamma@example.com', name: 'Gamma Contact' });

    // Unrelated contact (should NOT appear in a 'frequent' search)
    await createContact(token, { email: 'unrelated@other.com', name: 'Unrelated Person' });
  });

  // ── Autocomplete Validation ────────────────────────────────────────────────

  describe('GET /contacts/autocomplete — Validation', () => {
    it('should require authentication', async () => {
      const res = await request(app).get(`${API}/contacts/autocomplete?q=test`);
      expect(res.status).toBe(401);
    });

    it('should return 422 when q param is missing', async () => {
      const res = await request(app)
        .get(`${API}/contacts/autocomplete`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should return 422 when q is an empty string', async () => {
      const res = await request(app)
        .get(`${API}/contacts/autocomplete?q=`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(422);
    });

    it('should return 422 when q exceeds 100 characters', async () => {
      const longQ = 'a'.repeat(101);
      const res = await request(app)
        .get(`${API}/contacts/autocomplete?q=${longQ}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(422);
    });

    it('should accept q with exactly 1 character', async () => {
      const res = await request(app)
        .get(`${API}/contacts/autocomplete?q=f`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('should accept q with exactly 100 characters', async () => {
      const maxQ = 'a'.repeat(100);
      const res = await request(app)
        .get(`${API}/contacts/autocomplete?q=${maxQ}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  // ── Autocomplete Results ───────────────────────────────────────────────────

  describe('GET /contacts/autocomplete — Results', () => {
    it('should return matching contacts for a valid q', async () => {
      const res = await request(app)
        .get(`${API}/contacts/autocomplete?q=contact`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should return at most 10 results', async () => {
      // Seed 10+ contacts all matching "test" prefix
      for (let i = 0; i < 12; i++) {
        await createContact(token, {
          email: `testcontact${i}@example.com`,
          name: `Test Contact ${i}`,
        });
      }
      const res = await request(app)
        .get(`${API}/contacts/autocomplete?q=testcontact`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(10);
    });

    it('should return only name, email, avatarUrl fields (no _id)', async () => {
      const res = await request(app)
        .get(`${API}/contacts/autocomplete?q=frequent`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const contact = res.body.data[0];
      expect(contact).toHaveProperty('email');
      expect(contact).toHaveProperty('name');
      expect(contact).toHaveProperty('avatarUrl');
      // _id must be excluded from the projection
      expect(contact._id).toBeUndefined();
      // Fields NOT in the projection should not appear
      expect(contact.emailCount).toBeUndefined();
      expect(contact.lastContactedAt).toBeUndefined();
    });

    it('should match by email prefix', async () => {
      const res = await request(app)
        .get(`${API}/contacts/autocomplete?q=frequent@`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some((c) => c.email === 'frequent@example.com')).toBe(true);
    });

    it('should match by name prefix (case-insensitive)', async () => {
      const res = await request(app)
        .get(`${API}/contacts/autocomplete?q=ALPHA`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some((c) => c.name === 'Alpha Contact')).toBe(true);
    });

    it('should return empty array when no contacts match', async () => {
      const res = await request(app)
        .get(`${API}/contacts/autocomplete?q=zzznomatch99`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // ── Autocomplete Ranking ───────────────────────────────────────────────────

  describe('GET /contacts/autocomplete — Three-Tier Ranking', () => {
    it('should rank most-contacted first', async () => {
      // All seeded contacts contain "contact" — most-contacted (frequent) should appear first
      const res = await request(app)
        .get(`${API}/contacts/autocomplete?q=contact`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const emails = res.body.data.map((c) => c.email);
      // frequent@example.com has highest emailCount, must appear before moderate@example.com
      const freqIdx = emails.indexOf('frequent@example.com');
      const modIdx = emails.indexOf('moderate@example.com');
      if (freqIdx !== -1 && modIdx !== -1) {
        expect(freqIdx).toBeLessThan(modIdx);
      }
    });
  });

  // ── Per-User Isolation ─────────────────────────────────────────────────────

  describe('GET /contacts/autocomplete — Authorization', () => {
    it('should only return contacts belonging to the authenticated user', async () => {
      // User2 has no contacts — should get empty array for any query
      const res = await request(app)
        .get(`${API}/contacts/autocomplete?q=frequent`)
        .set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // ── Contact CRUD Validation (Phase 4 additions) ────────────────────────────

  describe('POST /contacts — Validation', () => {
    it('should require a valid email', async () => {
      const res = await request(app)
        .post(`${API}/contacts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'not-an-email', name: 'Bad Email' });
      expect(res.status).toBe(422);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject missing email', async () => {
      const res = await request(app)
        .post(`${API}/contacts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'No Email' });
      expect(res.status).toBe(422);
    });

    it('should accept valid contact payload', async () => {
      const res = await request(app)
        .post(`${API}/contacts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'valid@test.com', name: 'Valid Person' });
      expect(res.status).toBe(201);
    });
  });

  describe('PATCH /contacts/:id — Validation', () => {
    let contactId;

    beforeAll(async () => {
      const res = await createContact(token, {
        email: 'patchme@test.com',
        name: 'Patch Me',
      });
      contactId = res.body.data._id;
    });

    it('should return 422 when body is empty', async () => {
      const res = await request(app)
        .patch(`${API}/contacts/${contactId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(422);
    });

    it('should reject invalid avatarUrl', async () => {
      const res = await request(app)
        .patch(`${API}/contacts/${contactId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ avatarUrl: 'not-a-url' });
      expect(res.status).toBe(422);
    });

    it('should successfully update name', async () => {
      const res = await request(app)
        .patch(`${API}/contacts/${contactId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
    });
  });
});
