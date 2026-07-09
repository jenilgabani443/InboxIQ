'use strict';

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { getRedisClient } = require('./redis');
const logger = require('../shared/utils/logger');
const { verifySocketToken } = require('../shared/utils/tokenUtils');
const EVENTS = require('../shared/constants/events');

const env = require('./env');

let io = null;

/**
 * Initializes Socket.IO on the given HTTP server.
 * - Uses Redis pub/sub adapter for horizontal scaling
 * - Authenticates every WebSocket connection with JWT
 * - Joins users to private rooms by userId
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
const initSocket = (httpServer) => {
  const redisClient = getRedisClient();
  const pubClient = redisClient.duplicate();
  const subClient = redisClient.duplicate();

  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS.split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.adapter(createAdapter(pubClient, subClient));

  // ── Authentication Middleware ─────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = await verifySocketToken(token);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      return next();
    } catch (error) {
      logger.warn('Socket auth failed:', { error: error.message });
      return next(new Error('Invalid authentication token'));
    }
  });

  // ── Connection Handler ────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    logger.info('Socket connected:', { userId: socket.userId, socketId: socket.id });

    // Join private user room — enables targeted event emission
    socket.join(`user:${socket.userId}`);

    // Handle typing indicator
    socket.on(EVENTS.TYPING_START, ({ threadId }) => {
      socket.to(`thread:${threadId}`).emit(EVENTS.TYPING_START, {
        userId: socket.userId,
        threadId,
      });
    });

    socket.on(EVENTS.TYPING_STOP, ({ threadId }) => {
      socket.to(`thread:${threadId}`).emit(EVENTS.TYPING_STOP, {
        userId: socket.userId,
        threadId,
      });
    });

    // Join thread room for collaborative features
    socket.on(EVENTS.JOIN_THREAD, ({ threadId }) => {
      socket.join(`thread:${threadId}`);
      logger.debug('Socket joined thread room:', { userId: socket.userId, threadId });
    });

    socket.on(EVENTS.LEAVE_THREAD, ({ threadId }) => {
      socket.leave(`thread:${threadId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected:', { userId: socket.userId, reason });
    });
  });

  logger.info('Socket.IO initialized with Redis adapter');
  return io;
};

/**
 * Returns the initialized Socket.IO instance.
 * Throws if called before initSocket().
 */
const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized. Call initSocket(httpServer) first.');
  return io;
};

/**
 * Emits an event to a specific user's private room.
 *
 * @param {string} userId
 * @param {string} event
 * @param {object} payload
 */
const emitToUser = (userId, event, payload) => {
  getIO().to(`user:${userId}`).emit(event, payload);
};

/**
 * Emits an event to all members of a thread room.
 *
 * @param {string} threadId
 * @param {string} event
 * @param {object} payload
 */
const emitToThread = (threadId, event, payload) => {
  getIO().to(`thread:${threadId}`).emit(event, payload);
};

module.exports = { initSocket, getIO, emitToUser, emitToThread };
