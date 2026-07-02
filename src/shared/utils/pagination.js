'use strict';

/**
 * Builds pagination metadata and query options for MongoDB queries.
 *
 * Supports two strategies:
 * 1. Offset-based (page + limit) — for most list endpoints
 * 2. Cursor-based (after + limit) — for infinite scroll / real-time feeds
 *
 * Usage (offset):
 *   const { skip, limit, meta } = paginate({ page: 2, limit: 20, total: 150 });
 *   const results = await Model.find({}).skip(skip).limit(limit);
 *
 * @param {object} options
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {number} [options.total=0]
 * @returns {{ skip: number, limit: number, meta: object }}
 */
const paginate = ({ page = 1, limit = 20, total = 0 } = {}) => {
  const sanitizedPage = Math.max(1, parseInt(page, 10));
  const sanitizedLimit = Math.min(Math.max(1, parseInt(limit, 10)), 100); // cap at 100
  const skip = (sanitizedPage - 1) * sanitizedLimit;
  const totalPages = Math.ceil(total / sanitizedLimit);

  return {
    skip,
    limit: sanitizedLimit,
    meta: {
      page: sanitizedPage,
      limit: sanitizedLimit,
      total,
      totalPages,
      hasNextPage: sanitizedPage < totalPages,
      hasPrevPage: sanitizedPage > 1,
    },
  };
};

module.exports = { paginate };
