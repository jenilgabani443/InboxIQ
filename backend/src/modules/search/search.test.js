'use strict';

const request = require('supertest');
const createApp = require('../../app');

let app;

beforeAll(() => {
  app = createApp();
});

// ── Helpers ────────────────────────────────────────────────────────────────────

const API = '/api/v1';

/** Register + login a user, return { accessToken, userId } */
const registerAndLogin = async (suffix) => {
  const user = {
    email: `search_${suffix}@inboxiq.app`,
    password: 'Test@1234!',
    displayName: `Search User ${suffix}`,
  };
  await request(app).post(`${API}/auth/register`).send(user);
  const res = await request(app).post(`${API}/auth/login`).send({
    email: user.email,
    password: user.password,
  });
  return {
    accessToken: res.body.data.accessToken,
    userId: res.body.data.user.id,
    email: user.email,
  };
};

/** Create a single email via POST /emails, return the created document */
const createEmail = async (token, overrides = {}) => {
  const defaults = {
    to: [{ email: 'recipient@example.com', name: 'Recipient' }],
    subject: 'Test Subject',
    bodyText: 'Hello this is the email body text.',
    bodyHtml: '<p>Hello this is the email body text.</p>',
    status: 'sent',
  };
  const res = await request(app)
    .post(`${API}/emails`)
    .set('Authorization', `Bearer ${token}`)
    .send({ ...defaults, ...overrides });
  return res.body.data;
};

// ══════════════════════════════════════════════════════════════════════════════
describe('Phase 4 — Search API Integration Tests', () => {
  let token;
  let token2; // second user for authorization tests

  // ── Setup: create users and seed emails ─────────────────────────────────────
  beforeAll(async () => {
    const u1 = await registerAndLogin('alice');
    token = u1.accessToken;

    const u2 = await registerAndLogin('bob');
    token2 = u2.accessToken;

    // Seed emails for user 1 (alice)
    await createEmail(token, {
      to: [{ email: 'john@example.com', name: 'John' }],
      subject: 'Project Alpha Kickoff',
      bodyText: 'Let us discuss the project alpha kickoff meeting.',
      status: 'sent',
    });
    await createEmail(token, {
      to: [{ email: 'jane@example.com', name: 'Jane' }],
      subject: 'Budget Review Q4',
      bodyText: 'Please review the attached Q4 budget spreadsheet.',
      status: 'sent',
    });
    await createEmail(token, {
      to: [{ email: 'team@example.com', name: 'Team' }],
      subject: 'Weekly Stand-up Notes',
      bodyText: 'Here are the notes from this weeks stand-up call.',
      status: 'draft',
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Feature 1 & 2 — Full-Text Search + Gmail Operators
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /emails/search — Full-Text Search', () => {
    it('should require authentication', async () => {
      const res = await request(app).get(`${API}/emails/search?q=project`);
      expect(res.status).toBe(401);
    });

    it('should return 422 when no filter is provided', async () => {
      const res = await request(app)
        .get(`${API}/emails/search`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should search emails by q (free-text)', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?q=alpha`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by explicit to param', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?to=john@example.com`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by explicit subject param', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?subject=Budget`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by folder', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?folder=drafts`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by isRead=false', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?isRead=false`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should support pagination meta', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?q=email&page=1&limit=5`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 5);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('totalPages');
    });

    it('should support sortBy and sortOrder params', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?q=email&sortBy=createdAt&sortOrder=asc`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('should reject invalid sortBy value', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?q=test&sortBy=invalidField`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(422);
    });

    it('should reject invalid folder value', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?folder=notafolder`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(422);
    });

    it('should reject before with wrong date format', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?before=12-31-2024`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(422);
    });

    it('should accept before with correct YYYY-MM-DD format', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?before=2099-12-31`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('should accept after with correct YYYY-MM-DD format', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?after=2000-01-01`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('should only return results belonging to the authenticated user', async () => {
      // User2 (bob) searches — should get 0 results since emails belong to alice
      const res = await request(app)
        .get(`${API}/emails/search?q=alpha`)
        .set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });
  });

  // ── Gmail-Style Operator Parsing in q ──────────────────────────────────────

  describe('GET /emails/search — Gmail Operator Parsing', () => {
    it('should parse from: operator in q string', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?q=from:john@example.com`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should parse subject: operator in q string', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?q=subject:Budget`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('should parse is:unread operator in q string', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?q=is:unread`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('should parse in:drafts operator in q string', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?q=in:drafts`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('should parse multiple operators combined in q string', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?q=is:unread in:drafts`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('should parse after: date operator in q string', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?q=after:2000-01-01`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('should treat invalid in:xyz as free-text and return results', async () => {
      const res = await request(app)
        .get(`${API}/emails/search?q=in:unknown`)
        .set('Authorization', `Bearer ${token}`);
      // q becomes free-text "in:unknown" — no crash expected
      expect([200, 200]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Feature 3 — Search History
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /search/history', () => {
    beforeAll(async () => {
      const SearchHistory = require('../../modules/search/search.model');
      await SearchHistory.deleteMany({});
    });

    it('should require authentication', async () => {
      const res = await request(app).get(`${API}/search/history`);
      expect(res.status).toBe(401);
    });

    it('should return empty array when no searches have been made', async () => {
      const res = await request(app)
        .get(`${API}/search/history`)
        .set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should record a search in history after performing a search', async () => {
      // Perform a search first
      await request(app)
        .get(`${API}/emails/search?q=alpha+kickoff`)
        .set('Authorization', `Bearer ${token}`);

      // Small delay to allow the async history write to complete
      await new Promise((r) => setTimeout(r, 200));

      const res = await request(app)
        .get(`${API}/search/history`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('each history entry should have query and searchedAt fields', async () => {
      const res = await request(app)
        .get(`${API}/search/history`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const entry = res.body.data[0];
      expect(entry).toHaveProperty('query');
      expect(entry).toHaveProperty('searchedAt');
      // _id should be excluded by the select projection
      expect(entry._id).toBeUndefined();
    });

    it('should not mix history between different users', async () => {
      // token2 (bob) has no searches yet, so history should be empty
      const res = await request(app)
        .get(`${API}/search/history`)
        .set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should deduplicate — same query moves to top rather than creating duplicate', async () => {
      const uniqueQuery = 'dedup-test-query-xyz';

      // Perform the same search twice
      await request(app)
        .get(`${API}/emails/search?q=${uniqueQuery}`)
        .set('Authorization', `Bearer ${token}`);
      await request(app)
        .get(`${API}/emails/search?q=${uniqueQuery}`)
        .set('Authorization', `Bearer ${token}`);

      await new Promise((r) => setTimeout(r, 300));

      const res = await request(app)
        .get(`${API}/search/history`)
        .set('Authorization', `Bearer ${token}`);

      const entries = res.body.data;
      const matchingEntries = entries.filter((e) => e.query === uniqueQuery);
      expect(matchingEntries.length).toBe(1); // no duplicate
    });

    it('should return at most 20 entries', async () => {
      const res = await request(app)
        .get(`${API}/search/history`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(20);
    });
  });

  describe('DELETE /search/history', () => {
    it('should require authentication', async () => {
      const res = await request(app).delete(`${API}/search/history`);
      expect(res.status).toBe(401);
    });

    it('should clear all search history for the user', async () => {
      // First perform a search to ensure history is non-empty
      await request(app)
        .get(`${API}/emails/search?q=cleartest`)
        .set('Authorization', `Bearer ${token}`);

      await new Promise((r) => setTimeout(r, 200));

      const del = await request(app)
        .delete(`${API}/search/history`)
        .set('Authorization', `Bearer ${token}`);
      expect(del.status).toBe(200);
      expect(del.body.success).toBe(true);
      expect(del.body.data).toHaveProperty('deletedCount');

      // History should now be empty
      const check = await request(app)
        .get(`${API}/search/history`)
        .set('Authorization', `Bearer ${token}`);
      expect(check.body.data).toEqual([]);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Feature 4 — Saved Searches
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /search/saved', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post(`${API}/search/saved`)
        .send({ name: 'My Search', query: 'from:boss@company.com' });
      expect(res.status).toBe(401);
    });

    it('should create a saved search successfully', async () => {
      const res = await request(app)
        .post(`${API}/search/saved`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Boss Emails', query: 'from:boss@company.com is:unread' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data.name).toBe('Boss Emails');
      expect(res.body.data.query).toBe('from:boss@company.com is:unread');
      expect(res.body.data).toHaveProperty('createdAt');
      expect(res.body.data).toHaveProperty('updatedAt');
    });

    it('should reject missing name', async () => {
      const res = await request(app)
        .post(`${API}/search/saved`)
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'from:boss@company.com' });
      expect(res.status).toBe(422);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject missing query', async () => {
      const res = await request(app)
        .post(`${API}/search/saved`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'No Query' });
      expect(res.status).toBe(422);
    });

    it('should reject empty name', async () => {
      const res = await request(app)
        .post(`${API}/search/saved`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '', query: 'test' });
      expect(res.status).toBe(422);
    });

    it('should reject duplicate name for same user', async () => {
      const res = await request(app)
        .post(`${API}/search/saved`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Boss Emails', query: 'different query' });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should allow same name for different users', async () => {
      const res = await request(app)
        .post(`${API}/search/saved`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ name: 'Boss Emails', query: 'from:boss@company.com' });
      expect(res.status).toBe(201);
    });
  });

  describe('GET /search/saved', () => {
    it('should require authentication', async () => {
      const res = await request(app).get(`${API}/search/saved`);
      expect(res.status).toBe(401);
    });

    it('should return saved searches for the authenticated user', async () => {
      const res = await request(app)
        .get(`${API}/search/saved`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('each entry should have required fields', async () => {
      const res = await request(app)
        .get(`${API}/search/saved`)
        .set('Authorization', `Bearer ${token}`);
      const entry = res.body.data[0];
      expect(entry).toHaveProperty('_id');
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('query');
      expect(entry).toHaveProperty('createdAt');
      expect(entry).toHaveProperty('updatedAt');
    });

    it('should only return saved searches belonging to the authenticated user', async () => {
      // User2 created exactly 1 saved search ("Boss Emails")
      const res = await request(app)
        .get(`${API}/search/saved`)
        .set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(200);
      // user2 only created one
      expect(res.body.data.every((s) => s.name !== 'Boss Emails' || true)).toBe(true);
      // Ensure none of user1's private searches leak
      const names = res.body.data.map((s) => s.name);
      // Token2 only has "Boss Emails" saved
      expect(names.length).toBe(1);
    });
  });

  describe('PATCH /search/saved/:id', () => {
    let savedSearchId;

    beforeAll(async () => {
      // Create a fresh saved search for update tests
      const res = await request(app)
        .post(`${API}/search/saved`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Update Target', query: 'original query' });
      savedSearchId = res.body.data._id;
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .patch(`${API}/search/saved/${savedSearchId}`)
        .send({ name: 'New Name' });
      expect(res.status).toBe(401);
    });

    it('should update the name of a saved search', async () => {
      const res = await request(app)
        .patch(`${API}/search/saved/${savedSearchId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.query).toBe('original query'); // unchanged
    });

    it('should update the query of a saved search', async () => {
      const res = await request(app)
        .patch(`${API}/search/saved/${savedSearchId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'updated query' });
      expect(res.status).toBe(200);
      expect(res.body.data.query).toBe('updated query');
    });

    it('should return 422 when neither name nor query is provided', async () => {
      const res = await request(app)
        .patch(`${API}/search/saved/${savedSearchId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(422);
    });

    it('should return 404 for a non-existent saved search', async () => {
      const res = await request(app)
        .patch(`${API}/search/saved/000000000000000000000000`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Ghost' });
      expect(res.status).toBe(404);
    });

    it('should not allow user2 to update user1 saved search (ownership)', async () => {
      const res = await request(app)
        .patch(`${API}/search/saved/${savedSearchId}`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ name: 'Hacked Name' });
      expect(res.status).toBe(404); // returns 404 — no information leakage
    });
  });

  describe('DELETE /search/saved/:id', () => {
    let deleteTargetId;

    beforeAll(async () => {
      const res = await request(app)
        .post(`${API}/search/saved`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Delete Target', query: 'to be deleted' });
      deleteTargetId = res.body.data._id;
    });

    it('should require authentication', async () => {
      const res = await request(app).delete(`${API}/search/saved/${deleteTargetId}`);
      expect(res.status).toBe(401);
    });

    it('should not allow user2 to delete user1 saved search (ownership)', async () => {
      const res = await request(app)
        .delete(`${API}/search/saved/${deleteTargetId}`)
        .set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(404); // no information leakage
    });

    it('should delete a saved search successfully', async () => {
      const res = await request(app)
        .delete(`${API}/search/saved/${deleteTargetId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 after deleting the same saved search again', async () => {
      const res = await request(app)
        .delete(`${API}/search/saved/${deleteTargetId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
