'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../../shared/middlewares/authenticate');
const validate = require('../../shared/middlewares/validate');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const ApiError = require('../../shared/utils/apiError');

const searchService = require('./search.service');
const {
  getHistorySchema,
  deleteHistorySchema,
  createSavedSearchSchema,
  updateSavedSearchSchema,
  deleteSavedSearchSchema,
} = require('./search.validator');

// All search routes require authentication
router.use(authenticate);

// ── Search History ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /search/history:
 *   get:
 *     tags:
 *       - Search
 *     summary: Get recent search history
 *     description: |
 *       Returns up to 20 most-recent search queries for the authenticated user,
 *       ordered from most recent to oldest.
 *       History is automatically maintained when the user performs a search via
 *       `GET /emails/search`.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Search history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: Search history retrieved
 *               data:
 *                 - query: "from:john@example.com subject:meeting"
 *                   searchedAt: "2024-06-01T10:00:00.000Z"
 *                 - query: "is:unread in:inbox"
 *                   searchedAt: "2024-05-31T08:30:00.000Z"
 *               meta: null
 *               errors: null
 *               timestamp: "2024-06-01T10:05:00.000Z"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  '/history',
  validate(getHistorySchema),
  asyncHandler(async (req, res) => {
    const history = await searchService.getHistory(req.user.id);
    return ApiResponse.ok(res, 'Search history retrieved', history);
  }),
);

/**
 * @swagger
 * /search/history:
 *   delete:
 *     tags:
 *       - Search
 *     summary: Clear search history
 *     description: Permanently deletes all search history entries for the authenticated user.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Search history cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: Search history cleared
 *               data:
 *                 deletedCount: 15
 *               meta: null
 *               errors: null
 *               timestamp: "2024-06-01T10:05:00.000Z"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/history',
  validate(deleteHistorySchema),
  asyncHandler(async (req, res) => {
    const result = await searchService.clearHistory(req.user.id);
    return ApiResponse.ok(res, 'Search history cleared', result);
  }),
);

// ── Saved Searches ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /search/saved:
 *   post:
 *     tags:
 *       - Search
 *     summary: Save a search query
 *     description: |
 *       Saves a frequently-used search query with a user-defined name.
 *       The `query` field supports Gmail-style operators.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - query
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: Unread from boss
 *               query:
 *                 type: string
 *                 maxLength: 500
 *                 example: "from:boss@company.com is:unread"
 *     responses:
 *       201:
 *         description: Saved search created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: Search saved
 *               data:
 *                 _id: "64a62f5cb25241213cf796b9"
 *                 name: Unread from boss
 *                 query: "from:boss@company.com is:unread"
 *                 createdAt: "2024-06-01T10:00:00.000Z"
 *                 updatedAt: "2024-06-01T10:00:00.000Z"
 *               meta: null
 *               errors: null
 *               timestamp: "2024-06-01T10:00:00.000Z"
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: A saved search with this name already exists
 *       422:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post(
  '/saved',
  validate(createSavedSearchSchema),
  asyncHandler(async (req, res) => {
    const { name, query } = req.body;
    const saved = await searchService.createSavedSearch(req.user.id, { name, query });
    return ApiResponse.created(res, 'Search saved', saved);
  }),
);

/**
 * @swagger
 * /search/saved:
 *   get:
 *     tags:
 *       - Search
 *     summary: List saved searches
 *     description: Returns all saved searches for the authenticated user, newest first.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Saved searches retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: Saved searches retrieved
 *               data:
 *                 - _id: "64a62f5cb25241213cf796b9"
 *                   name: Unread from boss
 *                   query: "from:boss@company.com is:unread"
 *                   createdAt: "2024-06-01T10:00:00.000Z"
 *                   updatedAt: "2024-06-01T10:00:00.000Z"
 *               meta: null
 *               errors: null
 *               timestamp: "2024-06-01T10:00:00.000Z"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  '/saved',
  asyncHandler(async (req, res) => {
    const saved = await searchService.getSavedSearches(req.user.id);
    return ApiResponse.ok(res, 'Saved searches retrieved', saved);
  }),
);

/**
 * @swagger
 * /search/saved/{id}:
 *   patch:
 *     tags:
 *       - Search
 *     summary: Update a saved search
 *     description: Update the name and/or query of a saved search. Only the owner can update.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Saved search ID
 *         example: 64a62f5cb25241213cf796b9
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: Updated search name
 *               query:
 *                 type: string
 *                 maxLength: 500
 *                 example: "from:boss@company.com is:unread in:inbox"
 *     responses:
 *       200:
 *         description: Saved search updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: Saved search updated
 *               data:
 *                 _id: "64a62f5cb25241213cf796b9"
 *                 name: Updated search name
 *                 query: "from:boss@company.com is:unread in:inbox"
 *                 createdAt: "2024-06-01T10:00:00.000Z"
 *                 updatedAt: "2024-06-02T08:00:00.000Z"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Saved search not found
 *       409:
 *         description: A saved search with this name already exists
 *       422:
 *         description: Validation error — at least one of name or query required
 *       500:
 *         description: Internal server error
 */
router.patch(
  '/saved/:id',
  validate(updateSavedSearchSchema),
  asyncHandler(async (req, res) => {
    const saved = await searchService.updateSavedSearch(req.user.id, req.params.id, req.body);
    return ApiResponse.ok(res, 'Saved search updated', saved);
  }),
);

/**
 * @swagger
 * /search/saved/{id}:
 *   delete:
 *     tags:
 *       - Search
 *     summary: Delete a saved search
 *     description: Permanently deletes a saved search. Only the owner can delete.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Saved search ID
 *         example: 64a62f5cb25241213cf796b9
 *     responses:
 *       200:
 *         description: Saved search deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: Saved search deleted
 *               data: null
 *               meta: null
 *               errors: null
 *               timestamp: "2024-06-01T10:00:00.000Z"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Saved search not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/saved/:id',
  validate(deleteSavedSearchSchema),
  asyncHandler(async (req, res) => {
    await searchService.deleteSavedSearch(req.user.id, req.params.id);
    return ApiResponse.ok(res, 'Saved search deleted');
  }),
);

module.exports = router;
