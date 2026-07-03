'use strict';

/**
 * Feature 1 — Thread Status Tests
 */

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../../app');
const Thread = require('./thread.model');
const { THREAD_STATUS } = require('../../shared/constants/emailStatus');

let app;

beforeAll(() => {
  app = createApp();
});

const API = '/api/v1';

const registerAndLogin = async (suffix) => {
  const user = {
    email: `thread_${suffix}@inboxiq.app`,
    password: 'Test@1234!',
    displayName: `Thread Test ${suffix}`,
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

describe('Feature 1 — Thread Status', () => {
  let tokenA, userIdA;
  let tokenB, userIdB;

  beforeAll(async () => {
    const userA = await registerAndLogin('statusA');
    tokenA = userA.accessToken;
    userIdA = userA.userId;

    const userB = await registerAndLogin('statusB');
    tokenB = userB.accessToken;
    userIdB = userB.userId;
  });

  const createThread = async (participants) => {
    const thread = await Thread.create({
      subject: 'Test Thread',
      participants,
    });
    return thread._id;
  };

  it('should successfully update thread status if user is a participant', async () => {
    const threadId = await createThread([userIdA]);

    const res = await request(app)
      .patch(`${API}/threads/${threadId}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: THREAD_STATUS.RESOLVED });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(THREAD_STATUS.RESOLVED);

    const updatedThread = await Thread.findById(threadId);
    expect(updatedThread.status).toBe(THREAD_STATUS.RESOLVED);
  });

  it('should deny update if user is NOT a participant', async () => {
    // Thread only belongs to B
    const threadId = await createThread([userIdB]);

    const res = await request(app)
      .patch(`${API}/threads/${threadId}/status`)
      .set('Authorization', `Bearer ${tokenA}`) // A tries to update
      .send({ status: THREAD_STATUS.PENDING });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not authorized/i);
  });

  it('should reject invalid status via Zod validation', async () => {
    const threadId = await createThread([userIdA]);

    const res = await request(app)
      .patch(`${API}/threads/${threadId}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/validation failed/i);
  });
});

describe('Feature 2 — Assign Thread to Teammate', () => {
  let tokenA, userIdA;
  let tokenB, userIdB;

  beforeAll(async () => {
    const userA = await registerAndLogin('assignA');
    tokenA = userA.accessToken;
    userIdA = userA.userId;

    const userB = await registerAndLogin('assignB');
    tokenB = userB.accessToken;
    userIdB = userB.userId;
  });

  const createThread = async (participants) => {
    const thread = await Thread.create({
      subject: 'Assign Test Thread',
      participants,
    });
    return thread._id;
  };

  it('should successfully assign a thread to a valid user', async () => {
    const threadId = await createThread([userIdA]);

    const res = await request(app)
      .patch(`${API}/threads/${threadId}/assign`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ assignedTo: userIdB });

    expect(res.status).toBe(200);
    expect(res.body.data.assignedTo).toBe(userIdB);

    const updatedThread = await Thread.findById(threadId);
    expect(updatedThread.assignedTo.toString()).toBe(userIdB);

    // Verify notification was created
    const Notification = require('../notification/notification.model');
    const notification = await Notification.findOne({
      userId: userIdB,
      type: 'assignment',
      referenceId: threadId,
    });
    expect(notification).not.toBeNull();
  });

  it('should allow unassigning a thread (setting assignedTo to null)', async () => {
    const threadId = await createThread([userIdA]);
    // Assign first
    await Thread.findByIdAndUpdate(threadId, { assignedTo: userIdB });

    const res = await request(app)
      .patch(`${API}/threads/${threadId}/assign`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ assignedTo: null });

    expect(res.status).toBe(200);
    expect(res.body.data.assignedTo).toBeNull();
  });

  it('should reject invalid user ID format via Zod', async () => {
    const threadId = await createThread([userIdA]);

    const res = await request(app)
      .patch(`${API}/threads/${threadId}/assign`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ assignedTo: 'not-an-id' });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/validation failed/i);
  });

  it('should return 404 if assigned user does not exist', async () => {
    const threadId = await createThread([userIdA]);
    const fakeUserId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .patch(`${API}/threads/${threadId}/assign`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ assignedTo: fakeUserId });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/user not found/i);
  });

  it('should deny assignment if user is NOT a participant', async () => {
    const threadId = await createThread([userIdB]); // Belongs to B

    const res = await request(app)
      .patch(`${API}/threads/${threadId}/assign`)
      .set('Authorization', `Bearer ${tokenA}`) // A tries to assign
      .send({ assignedTo: userIdB });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not authorized/i);
  });
});

describe('Feature 3 — Internal Notes on Threads', () => {
  let tokenA, userIdA;
  let tokenB, userIdB;
  let tokenC, userIdC;

  beforeAll(async () => {
    const userA = await registerAndLogin('notesA');
    tokenA = userA.accessToken;
    userIdA = userA.userId;

    const userB = await registerAndLogin('notesB');
    tokenB = userB.accessToken;
    userIdB = userB.userId;

    const userC = await registerAndLogin('notesC');
    tokenC = userC.accessToken;
    userIdC = userC.userId;
  });

  const createThread = async (participants) => {
    const thread = await Thread.create({
      subject: 'Notes Test Thread',
      participants,
    });
    return thread._id;
  };

  it('should successfully add a note to a thread as a participant', async () => {
    const threadId = await createThread([userIdA, userIdB]);

    const res = await request(app)
      .post(`${API}/threads/${threadId}/notes`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ body: 'This is a test note' });

    expect(res.status).toBe(201);
    expect(res.body.data.body).toBe('This is a test note');
    expect(res.body.data.authorId.toString()).toBe(userIdA);
  });

  it('should deny adding a note if the user is NOT a participant', async () => {
    const threadId = await createThread([userIdA]); // User C is not a participant

    const res = await request(app)
      .post(`${API}/threads/${threadId}/notes`)
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ body: 'Sneaky note' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not authorized/i);
  });

  it('should successfully retrieve all notes for a thread', async () => {
    const threadId = await createThread([userIdA, userIdB]);

    await request(app)
      .post(`${API}/threads/${threadId}/notes`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ body: 'First note by A' });

    await request(app)
      .post(`${API}/threads/${threadId}/notes`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ body: 'Second note by B' });

    const res = await request(app)
      .get(`${API}/threads/${threadId}/notes`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].body).toBe('First note by A');
    expect(res.body.data[1].body).toBe('Second note by B');
    // Ensure author was populated
    expect(res.body.data[0].authorId.displayName).toBeDefined();
  });

  it('should deny retrieving notes if the user is NOT a participant', async () => {
    const threadId = await createThread([userIdA]); 

    const res = await request(app)
      .get(`${API}/threads/${threadId}/notes`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
  });

  it('should allow the author to delete their own note', async () => {
    const threadId = await createThread([userIdA]);

    const postRes = await request(app)
      .post(`${API}/threads/${threadId}/notes`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ body: 'Note to be deleted' });
    
    const noteId = postRes.body.data._id;

    const delRes = await request(app)
      .delete(`${API}/threads/${threadId}/notes/${noteId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(delRes.status).toBe(200);

    const getRes = await request(app)
      .get(`${API}/threads/${threadId}/notes`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(getRes.body.data.length).toBe(0);
  });

  it('should deny deletion of a note by another user', async () => {
    const threadId = await createThread([userIdA, userIdB]);

    const postRes = await request(app)
      .post(`${API}/threads/${threadId}/notes`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ body: 'A private note' });
    
    const noteId = postRes.body.data._id;

    // User B tries to delete User A's note
    const delRes = await request(app)
      .delete(`${API}/threads/${threadId}/notes/${noteId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(delRes.status).toBe(403);
    expect(delRes.body.message).toMatch(/only delete your own/i);
  });

  it('should reject invalid validation formats via Zod', async () => {
    const threadId = await createThread([userIdA]);

    const res = await request(app)
      .post(`${API}/threads/${threadId}/notes`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ body: '' }); // Empty body fails min(1)

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/validation failed/i);
  });
});

describe('Feature 4 — @Mention Support in Internal Notes', () => {
  let tokenA, userIdA;
  let tokenB, userIdB;
  let tokenC, userIdC;

  beforeAll(async () => {
    const userA = await registerAndLogin('mentionA');
    tokenA = userA.accessToken;
    userIdA = userA.userId;

    const userB = await registerAndLogin('mentionB');
    tokenB = userB.accessToken;
    userIdB = userB.userId;

    const userC = await registerAndLogin('mentionC');
    tokenC = userC.accessToken;
    userIdC = userC.userId;
  });

  const createThread = async (participants) => {
    const thread = await Thread.create({
      subject: 'Mentions Test Thread',
      participants,
    });
    return thread._id;
  };

  it('should successfully add a note with a single mention and create notification', async () => {
    const threadId = await createThread([userIdA, userIdB]);

    const res = await request(app)
      .post(`${API}/threads/${threadId}/notes`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ body: 'Hey', mentions: [userIdB] });

    expect(res.status).toBe(201);
    expect(res.body.data.mentions).toEqual([userIdB]);

    // Check Notification
    const Notification = require('../notification/notification.model');
    const notif = await Notification.findOne({
      userId: userIdB,
      type: 'mention',
      referenceId: threadId,
    });
    expect(notif).not.toBeNull();
  });

  it('should handle multiple mentions and de-duplicate them', async () => {
    const threadId = await createThread([userIdA, userIdB, userIdC]);

    const res = await request(app)
      .post(`${API}/threads/${threadId}/notes`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ body: 'Hey all', mentions: [userIdB, userIdC, userIdB] }); // duplicate B

    expect(res.status).toBe(201);
    expect(res.body.data.mentions.length).toBe(2);
    expect(res.body.data.mentions).toContain(userIdB);
    expect(res.body.data.mentions).toContain(userIdC);

    const Notification = require('../notification/notification.model');
    const notifs = await Notification.find({
      userId: { $in: [userIdB, userIdC] },
      type: 'mention',
      referenceId: threadId,
    }).sort({ createdAt: -1 });

    expect(notifs.length).toBeGreaterThanOrEqual(2);
  });

  it('should reject if a mentioned user does not exist', async () => {
    const threadId = await createThread([userIdA]);
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post(`${API}/threads/${threadId}/notes`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ body: 'Hey fake', mentions: [fakeId] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/do not exist/i);
  });
});

describe('Feature 5 — Shared Team Inbox (Threads)', () => {
  let tokenA, userIdA;
  let tokenB, userIdB;
  let User;

  beforeAll(async () => {
    User = require('../user/user.model');
    
    const userA = await registerAndLogin('sharedA');
    tokenA = userA.accessToken;
    userIdA = userA.userId;

    const userB = await registerAndLogin('sharedB');
    tokenB = userB.accessToken;
    userIdB = userB.userId;
  });

  it('should return 400 if shared=true but user has no teamId', async () => {
    const res = await request(app)
      .get(`${API}/threads?shared=true`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not belong to a team/i);
  });

  it('should return threads for the team when shared=true and user has teamId', async () => {
    const teamId = new mongoose.Types.ObjectId();
    
    // Assign teamId to user A
    await User.findByIdAndUpdate(userIdA, { teamId });

    // Create a thread belonging to the team (user A doesn't have to be a participant)
    const thread = await Thread.create({
      subject: 'Team Thread',
      participants: [userIdB], // B is participant, not A
      teamId,
    });

    const res = await request(app)
      .get(`${API}/threads?shared=true`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.some(t => t._id === thread._id.toString())).toBe(true);
  });

  it('should return ONLY own threads when shared=true is omitted', async () => {
    // User A has teamId, but omits shared=true
    const res = await request(app)
      .get(`${API}/threads`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    // The previously created thread had participant B, not A, so it shouldn't appear here
    expect(res.body.data.some(t => t.subject === 'Team Thread')).toBe(false);
  });
});
