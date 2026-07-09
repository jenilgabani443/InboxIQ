# 📧 InboxIQ — Email Productivity Platform API

> **Production-grade · Resume-worthy · Scalable**

[![CI](https://github.com/your-org/inboxiq/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/inboxiq/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/your-org/inboxiq/badge.svg)](https://codecov.io/gh/your-org/inboxiq)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## 📌 Project Overview
InboxIQ is a modern email productivity API inspired by Gmail, Superhuman, and Titan. It is designed to solve real inbox management problems with a clean architecture, real-time communication, and AI-assisted triage. The API is built to be secure, scalable, and highly performant, providing a robust backend for any email collaboration frontend.

---

## 🏗 Architecture Overview
InboxIQ utilizes a modular, service-oriented architecture designed for scalability and maintainability.
- **Client (Frontend)** interacts with the **Express API** via HTTPS or WebSocket.
- **Express API** handles authentication, input validation, and business logic routing.
- **MongoDB Atlas** serves as the primary persistent data store for users, emails, threads, and metadata.
- **Redis** manages caching, rate-limiting counters, token blacklists, and powers the Pub/Sub mechanism for WebSocket scale-out.
- **Socket.IO** provides real-time bi-directional events (new email alerts, typing indicators).
- **BullMQ** handles background processing (sending emails, AI analysis, indexing) asynchronously.
- **Cloudinary CDN** stores and serves email attachments securely.

```
Client ──► Nginx ──► Express API ──► MongoDB Atlas
                  └──► Socket.IO ──► Redis (pub/sub)
                                └──► Bull Queues
                                └──► Cloudinary CDN
```

---

## 🚀 Technology Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 20+ |
| **Framework** | Express.js 4 |
| **Database** | MongoDB 7 + Mongoose 8 |
| **Cache / Queues** | Redis 7 + BullMQ |
| **Real-time** | Socket.IO 4 (Redis adapter) |
| **File Storage** | Cloudinary v2 |
| **Auth** | JWT (access + refresh rotation) |
| **Validation** | Zod |
| **Documentation** | Swagger / OpenAPI 3.0 |
| **Testing** | Jest + Supertest |
| **Containerization** | Docker + Docker Compose |
| **CI/CD** | GitHub Actions |

---

## 📂 Folder Structure

```
src/
├── config/          # DB, Redis, Cloudinary, Socket.IO, Env validation
├── modules/         # Feature modules (auth, email, thread, label, ...)
│   └── <module>/
│       ├── *.controller.js
│       ├── *.service.js
│       ├── *.routes.js
│       ├── *.model.js
│       ├── *.validator.js
│       └── *.test.js
├── shared/
│   ├── middlewares/ # authenticate, authorize, validate, rateLimiter, errorHandler
│   ├── utils/       # asyncHandler, apiResponse, apiError, pagination, tokenUtils
│   └── constants/   # HTTP status, Socket events, roles, email status
├── docs/            # Swagger setup
├── tests/           # Jest setup/teardown
├── app.js           # Express factory
└── server.js        # HTTP + Socket.IO bootstrap
```

---

## 💻 Installation Guide

### Prerequisites
- **Node.js 20+**
- **Docker & Docker Compose** (for containerized setup)
- **MongoDB** (if running locally without Docker)
- **Redis** (if running locally without Docker)

### 1. Clone & Configure
```bash
git clone https://github.com/your-org/inboxiq.git
cd inboxiq
cp .env.example .env
```

---

## 🔧 Environment Setup (.env Explanation)
InboxIQ is designed to fail-fast if misconfigured. The configuration module (`src/config/env.js`) uses **Zod** to validate variables on application startup.

Key configurations in `.env`:
- **Core**: `NODE_ENV` (`development`, `production`, `test`), `PORT` (API port).
- **Databases**: `MONGO_URI` (MongoDB connection string), `REDIS_URL` (Redis connection string).
- **Security**: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (Strong cryptographic keys), `CORS_ORIGINS` (Allowed client URLs).
- **Limits**: `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX` (Request throttling).
- **Integrations**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (Attachment hosting).

Edit the `.env` file with your specific credentials before running the application.

---

## 🐳 Docker Deployment & Docker Compose Usage

### Development (Docker Compose)
The recommended way to run InboxIQ is via Docker Compose, which automatically provisions the API, MongoDB, and Redis.

```bash
# Start the full stack
npm run docker:dev

# Start with Redis Commander GUI (available on port 8081)
docker-compose -f docker/docker-compose.yml --profile tools up

# Stop the stack and remove volumes
npm run docker:down
```
This maps the API to `http://localhost:5000`, MongoDB to `localhost:27017`, and Redis to `localhost:6379` (in non-hardened environments).

---

## 🏃 Running Locally

If you prefer to run the application directly on your host machine without Docker:

```bash
# 1. Install dependencies
npm install

# 2. Ensure your local MongoDB and Redis are running
# 3. Start in development mode (with auto-reload)
npm run dev

# Or start in production mode
npm start
```

---

## 🧪 Running Tests
The project contains over 240 automated integration and unit tests using Jest.

```bash
# Run all test suites
npm test

# Run tests with coverage report
npm run test:coverage

# Run in watch mode for development
npm run test:watch
```

---

## 📖 API Overview

| Module | Base URL | Functionality |
|--------|---------|-----------|
| **Auth** | `/api/v1/auth` | Registration, Login, Logout, Refresh, MFA, Active Sessions |
| **Users** | `/api/v1/users` | Profile management, Preferences, Vacations |
| **Emails** | `/api/v1/emails` | Compose, Send, List, Search, Archive, Snooze |
| **Threads** | `/api/v1/threads` | Conversation listing, Collaboration, Notes, Assignments |
| **Labels** | `/api/v1/labels` | CRUD operations for color-coded tagging |
| **Attachments** | `/api/v1/attachments` | File upload/delete via Cloudinary |
| **Filters** | `/api/v1/filters` | Auto-rules engine for incoming emails |
| **AI** | `/api/v1/ai` | Smart replies, Thread summarization, Priority scoring |

---

## 📚 Swagger Usage
Interactive API documentation is generated via `swagger-jsdoc` and `swagger-ui-express`.
- **UI Portal**: `http://localhost:5000/api-docs`
- **JSON Spec**: `http://localhost:5000/api-docs.json`

Use the **Authorize** button in the Swagger UI to inject your `Bearer` token for protected endpoints.

---

## 🏥 Health Endpoints
Use these endpoints to monitor the system status:
- **`GET /api/v1/health`**: Extensive check (MongoDB, Redis, CPU, memory).
- **`GET /api/v1/health/ready`**: Quick liveness probe (used by Docker `HEALTHCHECK`).
- **`GET /api/v1/health/metrics`**: Advanced system metrics.

---

## 🛡️ Security Recommendations
- **Always run the Docker container as a non-root user** (pre-configured in the Dockerfile).
- **Use Read-Only filesystems** and map `tmpfs` to `/tmp` and `/app/logs` in production.
- **Drop Linux capabilities** (`cap_drop: ALL`) to prevent kernel privilege escalation.
- **Rotate JWT Secrets** periodically and enforce short expiration times (e.g., 15m for access).
- **Never expose DB ports** (27017, 6379) directly to the public internet; isolate them on internal Docker bridge networks.

---

## 🚀 GitHub Actions Overview
The CI/CD pipeline (`.github/workflows/ci.yml`) enforces code quality on `push` and `pull_request` to `main/develop` branches:
1. **Linting**: Ensures code style conformity.
2. **Testing**: Runs the Jest suite and fails if tests break.
3. **Coverage Artifacts**: Uploads coverage reports for review.
4. **Docker Build Verification**: Confirms the `Dockerfile` successfully builds in a clean environment.

---

## 📋 Production Deployment Checklist
Before deploying to AWS ECS, Kubernetes, or DigitalOcean, verify:
- [ ] `.env` uses strong, uniquely generated cryptographic secrets.
- [ ] `NODE_ENV` is set to `production`.
- [ ] MongoDB Atlas URI is used (do not run stateful DBs in stateless containers).
- [ ] Cloudinary credentials are valid and tested.
- [ ] A reverse proxy (Nginx/ALB) is configured with SSL/TLS termination.
- [ ] Rate limits (`RATE_LIMIT_MAX`) are tuned for your specific traffic expectations.
- [ ] BullMQ workers are scaled proportionally to web traffic.

---

## 💾 Backup and Restore Recommendations
- **MongoDB**: Use MongoDB Atlas automated continuous backups (Point-in-Time recovery) or schedule `mongodump` cronjobs pushed to Amazon S3.
- **Redis**: Enable RDB persistence (pre-configured) or AOF (Append Only File) if running self-hosted. For caching/BullMQ, data loss is typically recoverable, but sessions might expire if flushed.

---

## 🛠 Troubleshooting Guide
- **`MongoServerError: bad auth`**: Verify `MONGO_URI` credentials.
- **`Error: connect ECONNREFUSED 127.0.0.1:6379`**: Redis is not running. Start the docker-compose stack.
- **`EACCES: permission denied, open 'logs/error...'`**: In Docker read-only mode, ensure a `tmpfs` is mounted at `/app/logs` with `mode: 0777`.
- **WebSocket connection dropping**: Ensure your reverse proxy supports HTTP/1.1 Upgrade headers and long-polling fallbacks.

---

## 📝 Logging
InboxIQ uses **Winston** for structured JSON logging.
- Console logging is enabled in development.
- Daily rotating file logs are written to `/app/logs/` (or mapped tmpfs).
- Logs include correlation IDs (if configured), error stack traces, and request metadata (Morgan integration).

---

## 🗺 Roadmap
- [x] Phase 0-8: Core Features, Auth, AI, Security
- [x] Phase 9: Docker Security & CI/CD Pipelines
- [ ] Phase 10: SMTP, OAuth, Mobile Push Integrations

---

## 📄 License
MIT © InboxIQ Engineering
