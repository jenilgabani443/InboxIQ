'use strict';

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const env = require('../config/env');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'InboxIQ API',
      version: '1.0.0',
      description: `
## Email Productivity Platform API

**InboxIQ** is a production-grade email productivity platform API.

### Authentication
All protected endpoints require a **Bearer JWT access token** in the Authorization header.

\`\`\`
Authorization: Bearer <access_token>
\`\`\`

### Response Format
All responses follow a standardized envelope:
\`\`\`json
{
  "success": true,
  "message": "Human-readable status message",
  "data": {},
  "meta": { "page": 1, "total": 100 },
  "errors": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
\`\`\`

### Rate Limiting
- Global: 100 req / 15min per IP
- Auth endpoints: 10 req / 15min per IP
- Upload endpoints: 50 req / hour per IP
      `,
      contact: {
        name: 'InboxIQ Engineering',
        email: 'engineering@inboxiq.app',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api/${env.API_VERSION}`,
        description: 'Development server',
      },
      {
        url: `https://api.inboxiq.app/api/${env.API_VERSION}`,
        description: 'Production server',
      },
    ],

    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        },
      },

      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', nullable: true },
            meta: { type: 'object', nullable: true },
            errors: { type: 'array', nullable: true },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
            hasNextPage: { type: 'boolean' },
            hasPrevPage: { type: 'boolean' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication & session management' },
      { name: 'Users', description: 'User profile & settings' },
      { name: 'Emails', description: 'Email compose, send, list, manage' },
      { name: 'Threads', description: 'Email thread management & collaboration' },
      { name: 'Labels', description: 'Custom label CRUD' },
      { name: 'Attachments', description: 'File upload & management' },
      { name: 'Contacts', description: 'Contact management & autocomplete' },
      { name: 'Filters', description: 'Automated email filter rules' },
      { name: 'Notifications', description: 'In-app notification management' },
      { name: 'AI', description: 'AI-powered productivity features' },
      { name: 'Health', description: 'Service health & readiness' },
      { name: 'Search', description: 'Full-text search, Gmail operators, history & saved searches' },
    ],
  },
  apis: ['./src/modules/**/*.routes.js', './src/modules/**/*.controller.js'],
};

const swaggerSpec = swaggerJsdoc(options);

const swaggerUiOptions = {
  customCss: '.swagger-ui .topbar { background-color: #1a1a2e; }',
  customSiteTitle: 'InboxIQ API Docs',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
};

/**
 * Registers Swagger UI at /api-docs and serves the JSON spec at /api-docs.json
 *
 * @param {import('express').Application} app
 */
const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

module.exports = { setupSwagger, swaggerSpec };
