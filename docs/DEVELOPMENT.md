# OpsPilot AI — Development Guide & AI Coding Rules

## 1. Purpose

This document defines how OpsPilot AI must be developed.

It is written for:

* Human developers
* Antigravity
* AI coding agents
* Future contributors

The goal is to build a production-quality SaaS application without sacrificing:

* Security
* Maintainability
* Scalability
* Testability
* Code quality
* Architecture consistency

AI coding agents must read:

```text
docs/PRODUCT.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API.md
docs/DEVELOPMENT.md
```

before making significant architectural changes.

---

# 2. Repository Structure

Phase 7 validation should include the API test, lint, build, Prisma validation/generation, web lint/build, and `git diff --check`. The dashboard and incident UI use real database-backed responses only; empty database results render empty states rather than fallback operational data.

The target monorepo structure is:

```text
opspilot-ai/
│
├── apps/
│   ├── web/
│   └── api/
│
├── services/
│   └── ai-service/
│
├── packages/
│   └── shared/
│
├── docs/
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   └── DEVELOPMENT.md
│
├── .github/
│   └── workflows/
│
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
└── README.md
```

---

# 3. Application Responsibilities

## Web

Location:

```text
apps/web
```

Responsibilities:

* User interface
* Authentication UI
* Dashboard
* Incident pages
* Event explorer
* Service management
* Organization management
* AI analysis visualization
* API key management
* Settings

The web application must not contain server-side database access.

---

# 4. API

Location:

```text
apps/api
```

Responsibilities:

* Authentication
* Authorization
* Organization management
* Projects
* Services
* Environments
* API keys
* Event ingestion
* Event querying
* Incident management
* Deployment management
* AI orchestration
* Dashboard APIs
* Audit logging

---

# 5. AI Service

Location:

```text
services/ai-service
```

Responsibilities:

* Root-cause analysis
* Incident summarization
* AI recommendations
* Incident copilot
* Postmortem generation
* AI-specific processing

Technology:

```text
Python
FastAPI
LangGraph
```

The AI service must not directly expose itself to the public frontend.

---

# 6. Shared Package

Location:

```text
packages/shared
```

Can contain:

* Shared TypeScript types
* Shared constants
* Shared enums
* API contracts where appropriate
* Validation schemas where genuinely reusable

Do not put business logic into the shared package.

---

# 7. Backend Folder Structure

Recommended:

```text
apps/api/
│
├── src/
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── validators/
│   ├── workers/
│   ├── queues/
│   ├── utils/
│   ├── types/
│   ├── app.ts
│   └── server.ts
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── package.json
└── tsconfig.json
```

---

# 8. Frontend Folder Structure

Recommended:

```text
apps/web/
│
├── app/
├── components/
├── features/
├── hooks/
├── lib/
├── services/
├── types/
├── utils/
├── public/
├── tests/
├── package.json
└── tsconfig.json
```

Use feature-oriented organization for complex functionality.

Example:

```text
features/
└── incidents/
    ├── components/
    ├── hooks/
    ├── services/
    ├── types/
    └── utils/
```

---

# 9. AI Service Structure

Recommended:

```text
services/ai-service/
│
├── app/
│   ├── api/
│   ├── agents/
│   ├── graphs/
│   ├── models/
│   ├── services/
│   ├── prompts/
│   ├── schemas/
│   ├── utils/
│   └── main.py
│
├── tests/
├── requirements.txt
└── README.md
```

AI prompts must not be scattered randomly throughout the codebase.

---

# 10. Technology Standards

## Frontend

Use:

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
TanStack Query
Recharts
```

## Backend

Use:

```text
Node.js
TypeScript
Express
Prisma
PostgreSQL
Redis
```

## AI

Use:

```text
Python
FastAPI
LangGraph
```

---

# 11. TypeScript Rules

Use strict TypeScript.

Avoid:

```typescript
any
```

unless there is a documented reason.

Prefer:

```typescript
unknown
```

with proper validation.

Do not suppress TypeScript errors with:

```typescript
// @ts-ignore
```

unless absolutely necessary and documented.

Avoid unnecessary type assertions.

---

# 12. Validation

All external input must be validated.

Use Zod on the TypeScript side.

Validate:

```text
Request body
Query parameters
Route parameters
Headers
Environment variables
External service responses
```

Never assume external input is valid.

---

# 13. Environment Variables

Secrets and environment-specific configuration must be stored in environment variables.

Example:

```text
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
SESSION_SECRET=
AI_SERVICE_URL=
AI_SERVICE_SECRET=
```

For local development:

```text
.env
```

must not be committed.

Provide:

```text
.env.example
```

with variable names but no real secrets.

Example:

```text
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
AI_SERVICE_URL=http://localhost:8001
AI_SERVICE_SECRET=
```

---

# 14. Secret Management

Never commit:

```text
API keys
Passwords
JWT secrets
Database passwords
Cloud credentials
LLM API keys
Private tokens
```

Never put secrets in:

```text
source code
README files
tests
seed data
Git history
frontend environment variables
```

Frontend-exposed environment variables must never contain server secrets.

---

Phase 3 API authentication requires these local environment variables in
`apps/api/.env`:

```text
DATABASE_URL=
PORT=8000
NODE_ENV=development
AUTH_COOKIE_NAME=opspilot_auth
AUTH_SECRET=
WEB_ORIGIN=http://localhost:3000
```

`AUTH_SECRET` must be a strong, private value of at least 32 characters. The
API issues it only through an HTTP-only cookie. Organization routes verify the
authenticated user's `OrganizationMember` record server-side before applying
centralized role checks; frontend organization IDs and roles are not trusted.

# Phase 5 Local Development

Telemetry ingestion requires a reachable Redis instance. Set `REDIS_URL` in
`apps/api/.env`; local development can use `redis://localhost:6379` or a
managed Redis URL. For Upstash, use the native `rediss://` connection string
including its password and port `6379`; the Upstash REST `https://` URL is not
compatible with BullMQ. The Phase 5 defaults are suitable for development:

```text
INGEST_RATE_LIMIT_MAX=600
INGEST_RATE_LIMIT_WINDOW_SECONDS=60
INGEST_IDEMPOTENCY_TTL_SECONDS=86400
INGEST_BODY_LIMIT=256kb
```

Run the API and worker in separate terminals:

```bash
pnpm --filter @opspilot-ai/api dev
pnpm --filter @opspilot-ai/api dev:worker
```

The API returns `202 Accepted` after an event enters BullMQ. The worker then
persists the event through Prisma and updates the ingestion key's
`lastUsedAt`. Redis-backed idempotency is scoped to an API key and expires
after the configured TTL. Incident detection, analytics, and AI processing
are not part of Phase 5.

# 15. Git Rules

Use Git continuously.

Recommended commit style:

```text
feat: add incident API
feat: add telemetry ingestion
fix: correct tenant authorization
test: add incident service tests
refactor: extract event repository
docs: update API specification
chore: update dependencies
```

Keep commits focused.

Avoid giant commits containing unrelated changes.

---

# 16. Branch Strategy

Main branch:

```text
main
```

Feature branches:

```text
feature/authentication
feature/event-ingestion
feature/incident-management
feature/ai-analysis
```

Bug fixes:

```text
fix/tenant-isolation
fix/event-validation
```

Do not directly make large experimental changes to `main`.

---

# 17. Development Workflow

Every feature should follow:

```text
Requirement
    ↓
Design
    ↓
API / DB Contract
    ↓
Implementation
    ↓
Tests
    ↓
Review
    ↓
Integration
```

Do not start coding complex features before understanding their data flow.

---

# 18. Feature Implementation Order

The MVP should be developed in phases.

## Phase 1 — Foundation

Implement:

```text
Monorepo
Web application
API application
AI service skeleton
Shared package
Environment configuration
Logging
Health checks
Error handling
```

---

## Phase 2 — Database

Implement:

```text
Prisma
PostgreSQL connection
Database schema
Migrations
Seed data
```

Tables:

```text
User
Organization
OrganizationMember
Project
Service
ServiceEnvironment
ApiKey
Event
Incident
IncidentEvent
Deployment
AIAnalysis
AuditLog
```

---

# 19. Phase 3 — Authentication

Implement:

```text
Register
Login
Logout
Current user
Session management
Password hashing
Authentication middleware
```

Test:

```text
Valid login
Invalid password
Unknown user
Logout
Expired session
Inactive user
```

---

# 20. Phase 4 — Authorization

Implement:

```text
Organization membership
Roles
Tenant isolation
Resource ownership
```

This phase is extremely important.

Test explicitly:

```text
User A → Organization A
User B → Organization B

User A must NOT access:
Organization B
Projects B
Services B
Events B
Incidents B
Deployments B
AI analyses B
```

A successful tenant-isolation test is mandatory before production deployment.

---

# 21. Phase 5 — Project and Service Management

Implement:

```text
Organizations
Projects
Services
Environments
API keys
```

Test all ownership relationships.

---

# 22. Phase 6 — Telemetry Ingestion

Implement:

```text
POST /api/v1/events
POST /api/v1/events/batch
GET /api/v1/events
```

Flow:

```text
API Key
   ↓
Authentication
   ↓
Validation
   ↓
Rate Limiting
   ↓
Tenant/Service Resolution
   ↓
Persist / Queue
   ↓
Worker
```

The API should respond quickly and avoid expensive synchronous processing.

---

# 23. Phase 7 — Incident Detection

Implement deterministic detection first.

Examples:

```text
Error rate threshold
Repeated error frequency
Latency threshold
Sudden event spike
Service failure
```

Example:

```text
Error rate > 10%
for 5 minutes
       ↓
Create incident
```

Do not depend on an LLM to detect every basic incident.

---

# 24. Phase 8 — Incident Management

Implement:

```text
Incident list
Incident detail
Incident timeline
Status updates
Severity
Assignment
Incident events
Resolution
```

Incident lifecycle:

```text
DETECTED
   ↓
OPEN
   ↓
INVESTIGATING
   ↓
MITIGATED
   ↓
RESOLVED
   ↓
POSTMORTEM
```

---

# 25. Phase 9 — Deployment Correlation

Implement:

```text
Deployment records
Deployment timeline
Incident deployment lookup
```

Initially use simple time-based correlation.

Example:

```text
Deployment
12:25

Errors increase
12:29

Incident
12:30
```

The system should identify the deployment as potentially relevant.

---

# 26. Phase 10 — AI Root Cause Analysis

Flow:

```text
Incident
   ↓
Retrieve Context
   ├── Events
   ├── Deployments
   ├── Service
   ├── Environment
   └── Historical Incidents
          ↓
Context Builder
          ↓
LangGraph
          ↓
Structured AI Output
          ↓
Store AIAnalysis
```

AI output must include:

```text
Root cause
Confidence
Evidence
Recommendations
```

---

# 27. Phase 11 — AI Incident Copilot

Implement:

```text
POST /incidents/:id/copilot
```

The copilot should answer questions using incident-specific context.

Examples:

```text
What happened?
What changed before the incident?
What should I investigate first?
Which deployment is suspicious?
What evidence supports the root cause?
```

The copilot must not hallucinate unavailable telemetry.

---

# 28. Phase 12 — Postmortem

After an incident is resolved, AI can generate:

```text
Incident summary
Timeline
Impact
Root cause
Contributing factors
Resolution
Preventive actions
```

The generated postmortem must be editable by the user.

---

# 29. Frontend Development Order

Build the frontend in this order:

```text
Authentication
      ↓
Organization selector
      ↓
Dashboard
      ↓
Projects
      ↓
Services
      ↓
Event explorer
      ↓
Incident list
      ↓
Incident detail
      ↓
AI analysis
      ↓
Settings
```

---

# 30. UI Principles

The UI should feel like a modern developer/SRE product.

Design goals:

* Clean
* Fast
* Professional
* Information-dense
* Responsive
* Accessible
* Consistent

Avoid:

* Excessive animations
* Decorative UI with no purpose
* Fake metrics
* Fake AI outputs
* Placeholder buttons pretending to work

---

# 31. Loading States

Every asynchronous UI operation must have a proper loading state.

Examples:

```text
Dashboard loading
Incident loading
AI analysis processing
Event fetching
API key creation
```

Avoid blank screens.

---

# 32. Error States

Every API-dependent page should handle:

```text
Loading
Success
Empty
Error
Unauthorized
Forbidden
```

Example:

```text
No incidents found
```

should be different from:

```text
Unable to load incidents
```

---

# 33. Testing Strategy

Testing is mandatory.

Use three levels:

```text
Unit
Integration
End-to-End
```

---

# 34. Unit Tests

Unit test:

```text
Authentication services
Authorization logic
Validation
Incident detection
Severity calculation
Correlation logic
AI context construction
Utility functions
```

---

# 35. Integration Tests

Test:

```text
API + PostgreSQL
API + Redis
Authentication
Database queries
Tenant authorization
Event ingestion
Incident creation
Deployment correlation
```

---

# 36. End-to-End Tests

Important flow:

```text
Register
   ↓
Login
   ↓
Create Organization
   ↓
Create Project
   ↓
Create Service
   ↓
Create Environment
   ↓
Create API Key
   ↓
Send Event
   ↓
Incident Detected
   ↓
View Incident
   ↓
Run AI Analysis
   ↓
Resolve Incident
   ↓
Generate Postmortem
```

This is the main product journey.

---

# 37. Security Testing

Explicitly test:

```text
Unauthorized access
Cross-tenant access
Invalid API keys
Revoked API keys
Expired credentials
Rate limits
Malformed payloads
Oversized payloads
Injection attempts
Mass assignment
Privilege escalation
```

Security tests are not optional.

---

# 38. Performance Testing

Before claiming scalability, measure it.

Important metrics:

```text
Event ingestion throughput
API response latency
Database query latency
Queue processing rate
Incident detection latency
AI analysis latency
Concurrent users
Error rate
```

Example benchmark:

```text
Events/sec: measured value
p95 ingestion latency: measured value
p99 latency: measured value
```

Never invent these numbers.

---

# 39. Observability

OpsPilot AI itself must be observable.

Backend logs should contain:

```text
requestId
timestamp
route
method
statusCode
duration
userId where appropriate
organizationId where appropriate
error code
```

Never log:

```text
password
API key
session secret
JWT
LLM API key
```

---

# 40. Request IDs

Every API request should have a request ID.

If supplied by the client:

```text
X-Request-ID
```

may be accepted after validation.

Otherwise generate one.

Return:

```text
X-Request-ID
```

in the response.

This helps debug distributed workflows.

---

# 41. Logging Levels

Use appropriate levels:

```text
DEBUG
INFO
WARN
ERROR
```

Production should avoid excessive DEBUG logging.

Logs must be structured where possible.

---

# 42. AI Reliability

AI must be treated as an unreliable external dependency.

Possible failures:

```text
Timeout
Rate limit
Invalid response
Malformed JSON
Provider unavailable
Model unavailable
Context too large
```

The system must handle these gracefully.

---

# 43. AI Structured Output

The AI service should return schema-validated output.

Example:

```json
{
  "rootCause": "Database connection pool exhaustion",
  "confidence": 0.91,
  "evidence": [],
  "recommendations": []
}
```

If the model produces invalid output:

```text
AI response
    ↓
Validation
    ↓
Invalid
    ↓
Retry / fallback
```

Do not blindly trust model output.

---

# 44. AI Cost Control

AI requests must be controlled.

Implement:

```text
Context limits
Token limits
Request limits
Caching where appropriate
Usage tracking
Model selection
Timeouts
Retries
```

Do not send the entire telemetry history to an LLM.

Retrieve only relevant context.

---

# 45. Background Jobs

Use workers for expensive operations.

Examples:

```text
Incident detection
Event correlation
AI analysis
Postmortem generation
Notifications
Future analytics
```

Preferred architecture:

```text
API
 │
 ▼
Queue
 │
 ▼
Worker
 │
 ▼
Database / AI Service
```

---

# 46. Worker Reliability

Workers must be:

* Idempotent where possible
* Retryable
* Observable
* Safe against duplicate processing

Failed jobs should not silently disappear.

Use retry policies and dead-letter handling where appropriate.

---

# 47. Database Migration Rules

All schema changes must use Prisma migrations.

Workflow:

```text
Modify schema.prisma
       ↓
Create migration
       ↓
Review migration
       ↓
Run tests
       ↓
Apply migration
```

Never casually edit an already-applied migration.

---

# 48. Dependency Management

Before adding a dependency, ask:

1. Is it actually necessary?
2. Does the existing stack already solve the problem?
3. Is it maintained?
4. Does it increase security risk?
5. Does it significantly increase bundle/install size?
6. Is there a simpler implementation?

Avoid unnecessary dependencies.

---

# 49. API Documentation

Every new public API endpoint must be documented in:

```text
docs/API.md
```

The implementation and documentation must remain synchronized.

---

# 50. Architecture Changes

AI coding agents must NOT redesign the architecture without approval.

Do not automatically:

```text
Split the API into microservices
Replace PostgreSQL
Replace Prisma
Replace Express
Replace Next.js
Introduce Kafka
Introduce Kubernetes
Introduce another database
```

unless there is a demonstrated requirement.

---

# 51. Scalability Philosophy

Start with a modular monolith.

```text
Next.js
   │
Express API
   │
PostgreSQL + Redis
   │
Workers
   │
FastAPI AI
```

This is the MVP architecture.

When scale requires separation, individual components can be extracted.

Example:

```text
Current:
API → Worker

Future:
API
 ├── Ingestion Service
 ├── Incident Service
 ├── Notification Service
 └── AI Orchestrator
```

Extraction must be driven by actual bottlenecks.

---

# 52. No Fake Features

Never create UI that claims functionality that does not exist.

Bad:

```text
"Slack connected"
```

when no Slack integration exists.

Bad:

```text
"AI detected 94% confidence"
```

when it is hardcoded.

Bad:

```text
"10,000 events/sec"
```

when it has not been measured.

Use:

```text
Coming soon
Not configured
No data available
```

when appropriate.

---

# 53. No Hardcoded Production Data

Do not hardcode:

```text
Incident counts
Event counts
AI results
Service health
Performance metrics
User data
```

Dashboard values must come from the API.

Development seed data is acceptable when clearly marked.

---

# 54. AI Coding Agent Rules

When Antigravity or another coding agent works on this repository, it must:

1. Read the relevant documentation first.
2. Understand existing code before modifying it.
3. Make small, focused changes.
4. Avoid unnecessary rewrites.
5. Preserve working functionality.
6. Follow the existing architecture.
7. Follow the database schema.
8. Follow the API contract.
9. Add validation.
10. Add authorization.
11. Add tests.
12. Run lint/type checks where available.
13. Explain important dependency additions.
14. Never expose secrets.
15. Never fabricate functionality.
16. Never bypass tenant isolation.
17. Never silently change API contracts.
18. Never make destructive production changes.
19. Update documentation when architecture changes.
20. Stop and request approval before major architectural changes.

---

# 55. AI Agent Change Protocol

For a significant feature, the agent should follow:

```text
1. Inspect relevant files
2. Explain intended changes
3. Implement smallest complete change
4. Run tests
5. Run type checking
6. Run linting
7. Report changed files
8. Report test results
9. Report remaining limitations
```

Do not generate hundreds of files unnecessarily.

---

# 56. Definition of Done

A feature is not considered complete until:

```text
[ ] Implementation complete
[ ] Validation implemented
[ ] Authorization verified
[ ] Error handling implemented
[ ] Tests added
[ ] Existing tests pass
[ ] Type checking passes
[ ] Linting passes
[ ] Documentation updated
[ ] No secrets committed
[ ] No fake functionality
```

---

# 57. Development Commands

The root workspace should support:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
```

Individual applications may expose their own commands.

Example:

```bash
pnpm --filter web dev
pnpm --filter api dev
```

Exact package scripts should remain consistent with the actual implementation.

---

# 58. Local Development Ports

Recommended:

```text
Web:
3000

API:
8000

AI Service:
8001
```

Example:

```text
http://localhost:3000
http://localhost:8000
http://localhost:8001
```

Production URLs must be provided through environment configuration.

---

# 59. Development Environment

The project is intended to work well in:

```text
GitHub Codespaces
VS Code
Antigravity
```

Avoid requiring unnecessary local infrastructure.

Where practical, use managed/cloud development resources for:

```text
PostgreSQL
Redis
AI APIs
```

Do not require Docker unless it provides a clear benefit.

---

# 60. Documentation Rules

Documentation should be updated when:

* API contracts change
* Database schema changes
* Architecture changes
* New infrastructure is introduced
* New environment variables are required
* Development workflow changes

Do not allow documentation to become significantly different from the implementation.

---

# 61. Production Readiness Checklist

Before production deployment:

```text
[ ] Authentication secure
[ ] Authorization tested
[ ] Tenant isolation tested
[ ] Secrets externalized
[ ] HTTPS enabled
[ ] CORS restricted
[ ] Rate limiting enabled
[ ] Request validation enabled
[ ] Database migrations tested
[ ] Backups configured
[ ] Error monitoring configured
[ ] Logging configured
[ ] Health checks configured
[ ] AI timeouts configured
[ ] AI failures handled
[ ] Worker retries configured
[ ] CI pipeline passing
[ ] E2E tests passing
[ ] Load testing completed
```

---

# 62. Final Development Principle

OpsPilot AI should be developed using the following principle:

```text
Simple enough to build.
Strong enough to deploy.
Modular enough to scale.
Secure enough to trust.
Observable enough to debug.
```

The goal is not to create the largest architecture.

The goal is to create a system that solves a real engineering problem and can evolve into a production SaaS platform.

---

# 63. Antigravity Instruction

Before implementing any feature, Antigravity must treat the following documents as the source of truth:

```text
docs/PRODUCT.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API.md
docs/DEVELOPMENT.md
```

Priority order:

```text
Security
   ↓
Correctness
   ↓
Architecture
   ↓
Testability
   ↓
Maintainability
   ↓
Performance
   ↓
Development Speed
```

Development speed must never justify compromising security, tenant isolation, correctness, or data integrity.
