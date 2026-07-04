# 📧 InboxIQ — Email Productivity Platform API

> **Production-grade · Resume-worthy · Scalable**

[![CI](https://github.com/your-org/inboxiq/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/inboxiq/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/your-org/inboxiq/badge.svg)](https://codecov.io/gh/your-org/inboxiq)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A modern email productivity API inspired by Gmail, Superhuman, and Titan — built to solve real inbox management problems with clean architecture, real-time communication, and AI-assisted triage.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Framework | Express.js 4 |
| Database | MongoDB 7 + Mongoose 8 |
| Cache / Queues | Redis 7 + Bull |
| Real-time | Socket.IO 4 (Redis adapter) |
| File Storage | Cloudinary v2 |
| Auth | JWT (access + refresh rotation) |
| Validation | Zod |
| Documentation | Swagger / OpenAPI 3.0 |
| Testing | Jest + Supertest |
| Containerization | Docker + Docker Compose |
| CI/CD | GitHub Actions |

---

## 📁 Project Structure

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

## ⚡ Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/inboxiq.git
cd inboxiq
cp .env.example .env
# Edit .env with your Cloudinary credentials
```

### 2. Start with Docker Compose (Recommended)

```bash
npm run docker:dev
```

This starts:
- **inboxiq-api** on `http://localhost:5000`
- **MongoDB** on `localhost:27017`
- **Redis** on `localhost:6379`

### 3. Start Locally

```bash
# Start MongoDB and Redis separately, then:
npm install
npm run dev
```

---

## 📚 API Documentation

Swagger UI is available at: **`http://localhost:5000/api-docs`**

OpenAPI JSON spec: **`http://localhost:5000/api-docs.json`**

---

## 🔑 API Overview

| Module | Base URL | Endpoints |
|--------|---------|-----------|
| Auth | `/api/v1/auth` | Register, Login, Logout, Refresh, MFA, Sessions |
| Users | `/api/v1/users` | Profile, Password, Signature, Vacation, Preferences |
| Emails | `/api/v1/emails` | Compose, Send, List, Search, Archive, Snooze |
| Threads | `/api/v1/threads` | List, Collaborate, Notes, Assign, Status |
| Labels | `/api/v1/labels` | CRUD, Color-coded |
| Attachments | `/api/v1/attachments` | Upload (Cloudinary), Delete |
| Contacts | `/api/v1/contacts` | CRUD, Autocomplete |
| Filters | `/api/v1/filters` | Auto-rules engine |
| Notifications | `/api/v1/notifications` | Real-time, Mark read |
| AI | `/api/v1/ai` | Smart replies, Thread summary, Priority scoring |

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## 🐳 Docker Commands

```bash
# Start dev environment
npm run docker:dev

# Start with Redis Commander GUI
docker-compose -f docker/docker-compose.yml --profile tools up

# Stop and clean volumes
npm run docker:down
```

---

## 🏗 Architecture

```
Client ──► Nginx ──► Express API ──► MongoDB Atlas
                  └──► Socket.IO ──► Redis (pub/sub)
                                └──► Bull Queues
                                └──► Cloudinary CDN
```

---

## 🔐 Security Features

- **JWT rotation** — refresh tokens rotate on every use, old tokens blacklisted in Redis
- **Refresh token reuse detection** — full session invalidation on potential theft
- **Helmet.js** — security headers (CSP, XSS, HSTS)
- **MongoDB sanitization** — prevents NoSQL injection
- **Redis-backed rate limiting** — enforced across all server instances
- **TOTP MFA** — Google Authenticator compatible
- **Soft deletes** — GDPR-compliant data handling
- **Zod validation** — all inputs validated at the middleware layer

---

## 🗺 Roadmap

- [x] Phase 0: Foundation & DevOps
- [x] Phase 1: Auth & Identity
- [x] Phase 2: Email Core
- [ ] Phase 3: Attachments & Labels *(in progress)*
- [ ] Phase 4: Full-text Search (Atlas Search)
- [ ] Phase 5: Real-time (Socket.IO)
- [ ] Phase 6: Collaboration
- [ ] Phase 7: AI Features (OpenAI/Gemini)
- [ ] Phase 8: Hardening & Observability
- [ ] Phase 9: Production Deploy (AWS ECS)
- [ ] Phase 10: SMTP, OAuth, Mobile Push

---

## 📄 License

MIT © InboxIQ Engineering

---

## 🚀 CI/CD Pipeline

The project uses GitHub Actions for Continuous Integration (CI) and automated verification.

### Workflow Purpose
The workflow ensures code quality and prevents broken builds from reaching main branches. It automatically lints code, runs the test suite, generates test coverage reports, and verifies that the production Docker image successfully builds.

### Trigger Conditions
The pipeline runs automatically on:
- `push` events to `main`, `master`, and `develop`
- `pull_request` events targeting `main`, `master`, and `develop`

### Pipeline Stages
1. **Checkout**: Checks out the repository using `actions/checkout`.
2. **Setup Node**: Uses Node.js v20 with npm caching enabled.
3. **Dependencies**: Installs dependencies immutably using `npm ci`.
4. **Environment**: Generates a temporary `.env` via `cp .env.example .env` (using placeholders instead of hardcoded secrets).
5. **Lint & Test**: Runs ESLint and full Jest test suites. Fails the pipeline if any test fails.
6. **Coverage**: Generates and uploads a code coverage artifact (retained for 14 days).
7. **Docker Verification**: Builds the production Docker image to ensure the `Dockerfile` configuration is healthy. No deployment is performed.

### How to Monitor Workflow Runs
After pushing code or opening a Pull Request:
1. Navigate to your repository on GitHub.
2. Click the **Actions** tab.
3. Select the latest **CI/CD Pipeline** run to view real-time logs for each stage.
4. You can also download the **coverage-report** artifact from the run summary page.
