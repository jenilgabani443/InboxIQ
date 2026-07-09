'use strict';

/**
 * Feature 5 — Shared Team Inbox Tests (Emails)
 */

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../../app');
const Email = require('./email.model');

let app;

beforeAll(() => {
  app = createApp();
});

const API = '/api/v1';

const registerAndLogin = async (suffix) => {
  const user = {
    email: `shared_email_${suffix}@inboxiq.app`,
    password: 'Test@1234!',
    displayName: `Shared Email Test ${suffix}`,
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

describe('Feature 5 — Shared Team Inbox (Emails)', () => {
  let tokenA, userIdA;
  let tokenB, userIdB;
  let User;

  beforeAll(async () => {
    User = require('../user/user.model');
    
    const userA = await registerAndLogin('A');
    tokenA = userA.accessToken;
    userIdA = userA.userId;

    const userB = await registerAndLogin('B');
    tokenB = userB.accessToken;
    userIdB = userB.userId;
  });

  it('should return 400 if shared=true but user has no teamId', async () => {
    const res = await request(app)
      .get(`${API}/emails?shared=true`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not belong to a team/i);
  });

  it('should return emails for the team when shared=true and user has teamId', async () => {
    const teamId = new mongoose.Types.ObjectId();
    
    // Assign teamId to user A
    await User.findByIdAndUpdate(userIdA, { teamId });

    // Create a thread and email belonging to the team (user A is not the sender)
    const Thread = require('../thread/thread.model');
    const thread = await Thread.create({
      subject: 'Team Email Thread',
      participants: [userIdB],
      teamId,
    });

    const email = await Email.create({
      threadId: thread._id,
      from: { userId: userIdB, email: 'b@test.com', name: 'B' },
      to: [{ email: 'c@test.com' }],
      subject: 'Team Email',
      teamId,
      status: 'sent',
      folder: 'inbox',
    });

    const res = await request(app)
      .get(`${API}/emails?shared=true`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.some(e => e._id === email._id.toString())).toBe(true);
  });

  it('should return ONLY own emails when shared=true is omitted', async () => {
    // User A has teamId, but omits shared=true
    const res = await request(app)
      .get(`${API}/emails`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some(e => e.subject === 'Team Email')).toBe(false);
  });
});
