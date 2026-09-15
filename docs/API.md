# OpsPilot AI — API Specification

## 1. Purpose

This document defines the REST API contract for OpsPilot AI.

The API is responsible for:

* Authentication
* Organization management
* Projects
* Services
* Environments
* API keys
* Telemetry ingestion
* Incidents
* Deployments
* AI analysis
* Dashboard data
* Audit logs
* Health checks

The API is implemented using:

```text
Node.js
TypeScript
Express
Prisma
PostgreSQL
Redis
```

Base URL:

```text
/api/v1
```

---

# 2. API Architecture

```text
Next.js Frontend
       │
       │ HTTPS
       ▼
Express API
       │
       ├── PostgreSQL
       │
       ├── Redis
       │
       └── Background Queue
                │
                ▼
             Workers
                │
                ▼
          FastAPI AI Service
```

The frontend must never access PostgreSQL directly.

The frontend must never call the AI service directly.

All application requests go through the Express API.

---

# 3. API Versioning

All public API endpoints must use:

```text
/api/v1
```

Example:

```text
GET /api/v1/incidents
```

Future breaking changes may use:

```text
/api/v2
```

Do not introduce breaking changes into `/api/v1`.

---

# 4. Authentication

Application users authenticate using secure authentication mechanisms.

Recommended MVP approach:

```text
HTTP-only secure cookie
```

The browser should not store sensitive authentication tokens in localStorage.

Authentication endpoints:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/refresh
```

If refresh-token authentication is implemented, refresh tokens must be rotated and revocable.

---

# 5. Register

## Endpoint

```text
POST /api/v1/auth/register
```

## Request

```json
{
  "name": "Arpit Dhumane",
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

## Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Arpit Dhumane",
      "email": "user@example.com"
    }
  }
}
```

Passwords must never appear in API responses.

---

# 6. Login

## Endpoint

```text
POST /api/v1/auth/login
```

## Request

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

## Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Arpit Dhumane",
      "email": "user@example.com"
    }
  }
}
```

Authentication state should be established using secure HTTP-only cookies.

---

# 7. Current User

## Endpoint

```text
GET /api/v1/auth/me
```

## Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Arpit Dhumane",
      "email": "user@example.com"
    },
    "organizations": [
      {
        "id": "uuid",
        "name": "Acme",
        "role": "OWNER"
      }
    ]
  }
}
```

---

# 8. Logout

## Endpoint

```text
POST /api/v1/auth/logout
```

## Response

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

The server must invalidate the authentication session/token where applicable.

---

# 9. Authentication Middleware

Protected routes must pass through authentication middleware.

Conceptually:

```text
Request
   │
   ▼
Authentication Middleware
   │
   ├── Invalid → 401
   │
   └── Valid
         │
         ▼
    Authorization
         │
         ├── Denied → 403
         │
         └── Allowed
```

Authentication and authorization must remain separate concerns.

---

# 10. Organization API

## List Organizations

```text
GET /api/v1/organizations
```

Returns organizations accessible to the authenticated user.

---

## Get Organization

```text
GET /api/v1/organizations/:organizationId
```

---

## Create Organization

```text
POST /api/v1/organizations
```

Request:

```json
{
  "name": "Acme Technologies",
  "slug": "acme-technologies"
}
```

---

## Update Organization

```text
PATCH /api/v1/organizations/:organizationId
```

Request:

```json
{
  "name": "Acme Technologies"
}
```

Only authorized users may update organization information.

---

# 11. Organization Members

## List Members

```text
GET /api/v1/organizations/:organizationId/members
```

## Invite Member

```text
POST /api/v1/organizations/:organizationId/members
```

Request:

```json
{
  "email": "developer@example.com",
  "role": "MEMBER"
}
```

## Change Role

```text
PATCH /api/v1/organizations/:organizationId/members/:memberId
```

Request:

```json
{
  "role": "ADMIN"
}
```

## Remove Member

```text
DELETE /api/v1/organizations/:organizationId/members/:memberId
```

Only OWNER/ADMIN permissions may perform appropriate membership-management actions.

The OWNER role must have additional protection against accidental removal.

---

# 12. Projects

## List Projects

```text
GET /api/v1/organizations/:organizationId/projects
```

## Create Project

```text
POST /api/v1/organizations/:organizationId/projects
```

Request:

```json
{
  "name": "Payment Platform",
  "slug": "payment-platform",
  "description": "Payment processing platform"
}
```

## Get Project

```text
GET /api/v1/projects/:projectId
```

## Update Project

```text
PATCH /api/v1/projects/:projectId
```

## Delete Project

```text
DELETE /api/v1/projects/:projectId
```

Deletion must be protected against accidental destructive operations.

---

# 13. Services

## List Services

```text
GET /api/v1/projects/:projectId/services
```

## Create Service

```text
POST /api/v1/projects/:projectId/services
```

Request:

```json
{
  "name": "Payment API",
  "slug": "payment-api",
  "description": "Main payment API"
}
```

## Get Service

```text
GET /api/v1/services/:serviceId
```

## Update Service

```text
PATCH /api/v1/services/:serviceId
```

---

# 14. Service Environments

## List Environments

```text
GET /api/v1/services/:serviceId/environments
```

## Create Environment

```text
POST /api/v1/services/:serviceId/environments
```

Request:

```json
{
  "name": "production"
}
```

## Update Environment

```text
PATCH /api/v1/environments/:environmentId
```

---

# 15. API Key Management

## Phase 4 Nested Resource API

Projects, services, environments, and API keys use organization-nested routes:

```text
GET    /api/v1/organizations/:organizationId/projects
POST   /api/v1/organizations/:organizationId/projects
GET    /api/v1/organizations/:organizationId/projects/:projectId
PATCH  /api/v1/organizations/:organizationId/projects/:projectId
DELETE /api/v1/organizations/:organizationId/projects/:projectId

GET    /api/v1/organizations/:organizationId/projects/:projectId/services
POST   /api/v1/organizations/:organizationId/projects/:projectId/services
GET    /api/v1/organizations/:organizationId/projects/:projectId/services/:serviceId
PATCH  /api/v1/organizations/:organizationId/projects/:projectId/services/:serviceId
DELETE /api/v1/organizations/:organizationId/projects/:projectId/services/:serviceId

GET    /api/v1/organizations/:organizationId/projects/:projectId/services/:serviceId/environments
POST   /api/v1/organizations/:organizationId/projects/:projectId/services/:serviceId/environments
GET    /api/v1/organizations/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId
PATCH  /api/v1/organizations/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId
DELETE /api/v1/organizations/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId
```

Project slugs are unique per organization, service slugs per project, and environment names per service. Names and descriptions are trimmed and bounded; slugs use lowercase hyphenated syntax. Deletes return `409 Conflict` when dependent services, keys, events, incidents, or deployments exist.

API keys are used for telemetry ingestion.

## Create API Key

```text
POST /api/v1/environments/:environmentId/api-keys
```

The canonical Phase 4 route is the fully nested environment route:

```text
POST /api/v1/organizations/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId/api-keys
GET  /api/v1/organizations/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId/api-keys
GET  /api/v1/organizations/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId/api-keys/:apiKeyId
POST /api/v1/organizations/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId/api-keys/:apiKeyId/revoke
POST /api/v1/organizations/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId/api-keys/:apiKeyId/rotate
```

Request:

```json
{
  "name": "Production Backend"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Production Backend",
    "key": "opsp_live_xxxxxxxxxxxxxxxxx"
  }
}
```

The full key should be returned only during creation.

Keys are generated with Node cryptographic random bytes in the `opspk_` format. Only a short prefix and SHA-256 hash are stored. The full secret is returned once on creation or rotation, never returned by list/get, never logged, and never written to audit metadata or browser storage. Rotation revokes the old record and creates a new record so the history remains auditable. Revocation is idempotent.

All routes require authentication and verified organization membership. Nested resource lookups verify organization, project, service, environment, and key ownership together. `OWNER` and `ADMIN` roles may manage resources; `MEMBER` and `VIEWER` have read-only access to this Phase 4 surface.

The client should display a warning that the key cannot be retrieved later.

---

## List API Keys

```text
GET /api/v1/environments/:environmentId/api-keys
```

Response must never contain the complete secret.

Example:

```json
{
  "id": "uuid",
  "name": "Production Backend",
  "keyPrefix": "opsp_live_8F3A",
  "lastUsedAt": "2026-09-01T12:30:00Z",
  "revokedAt": null
}
```

---

## Revoke API Key

```text
POST /api/v1/api-keys/:apiKeyId/revoke
```

Revoked keys must immediately stop authenticating ingestion requests.

---

# 16. Telemetry Ingestion

Telemetry ingestion is a high-volume endpoint.

## Endpoint

```text
POST /api/v1/events
```

Authentication:

```text
Authorization: Bearer opspk_xxxxxxxxx
```

This endpoint uses an ingestion API key rather than normal user authentication.

## Phase 5 Ingestion Contract

`POST /api/v1/events` authenticates with `Authorization: Bearer opspk_...`; browser cookies are not required. The API resolves the API key to its environment, service, project, and organization, validates the event with Zod, applies the credential-scoped Redis rate limit, and enqueues the normalized event. It returns `202 Accepted` only after queue insertion succeeds. PostgreSQL persistence happens in the background worker.

Supported `type` values are `ERROR`, `WARNING`, `INFO`, `PERFORMANCE`, and `DEPLOYMENT`. Supported `level` values are `ERROR`, `WARN`, `INFO`, and `DEBUG`. `timestamp` is optional ISO-8601 and defaults to server time; `source` defaults to `unknown`. `metadata` and `payload` are bounded JSON objects and are limited to 32KB each. The ingestion body limit is configured by `INGEST_BODY_LIMIT` and defaults to `256kb`.

An optional `Idempotency-Key` is scoped to the API key and stored in Redis for `INGEST_IDEMPOTENCY_TTL_SECONDS` (24 hours by default). Replays return `202` with `status: duplicate` and the original event ID. Rate limits are configured with `INGEST_RATE_LIMIT_MAX` and `INGEST_RATE_LIMIT_WINDOW_SECONDS` and return `429` when exceeded.

Example:

```bash
curl -X POST http://localhost:8000/api/v1/events \
  -H 'Authorization: Bearer opspk_example_only' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: phase5-test-001' \
  -d '{"type":"ERROR","level":"ERROR","message":"Database connection timeout","source":"api-server"}'
```

Responses use `401` for missing, malformed, revoked, or expired credentials, `400` for invalid payloads, `413` for oversized requests, `429` for rate limiting, and `503` when Redis or queue insertion is unavailable. Tenant IDs are not accepted from the event body.

---

# 17. Single Event Request

Example:

```json
{
  "type": "ERROR",
  "level": "ERROR",
  "message": "Database connection timeout",
  "source": "payment-service",
  "timestamp": "2026-09-01T12:30:00Z",
  "traceId": "abc123",
  "requestId": "req_123",
  "metadata": {
    "endpoint": "/api/payment",
    "statusCode": 500
  },
  "payload": {
    "database": "postgres"
  }
}
```

The service/environment is determined from the API key.

The client must not be allowed to override the API key's organization or service scope.

---

# 18. Batch Event Ingestion

To support higher throughput:

```text
POST /api/v1/events/batch
```

Request:

```json
{
  "events": [
    {
      "type": "ERROR",
      "level": "ERROR",
      "message": "Connection timeout",
      "timestamp": "2026-09-01T12:30:00Z"
    },
    {
      "type": "WARNING",
      "level": "WARNING",
      "message": "High latency",
      "timestamp": "2026-09-01T12:30:02Z"
    }
  ]
}
```

The API should enforce:

* Maximum request size
* Maximum events per batch
* Payload validation
* Rate limits
* Authentication
* Tenant isolation

---

# 19. Event Ingestion Processing

The ingestion endpoint should remain lightweight.

Preferred flow:

```text
Client
  │
  ▼
POST /events
  │
  ├── Validate API key
  ├── Validate payload
  ├── Apply rate limit
  └── Persist/enqueue
          │
          ▼
       Queue
          │
          ▼
       Worker
          │
          ├── Detection
          ├── Correlation
          └── Incident creation
```

Do not run expensive AI analysis synchronously inside the ingestion request.

---

# 20. Event Query API

## List Events

```text
GET /api/v1/events
```

Supported query parameters:

```text
organizationId
projectId
serviceId
environmentId
type
level
startTime
endTime
traceId
requestId
incidentId
page
limit
```

Example:

```text
GET /api/v1/events?serviceId=uuid&level=ERROR&limit=50
```

All event queries must be organization-scoped.

---

# 21. Pagination

List endpoints should support pagination.

Recommended format:

```text
?page=1&limit=50
```

Response:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 250,
    "totalPages": 5
  }
}
```

For very high-volume event APIs, cursor-based pagination should be introduced.

Example:

```text
?cursor=eyJpZCI6...
```

The implementation should avoid expensive offset pagination for very large telemetry datasets.

---

# 22. Incidents

## List Incidents

```text
GET /api/v1/incidents
```

Filters:

```text
status
severity
projectId
serviceId
environmentId
assignedTo
startTime
endTime
```

Example:

```text
GET /api/v1/incidents?status=OPEN&severity=P1
```

---

## Create Incident

```text
POST /api/v1/incidents
```

Request:

```json
{
  "serviceId": "uuid",
  "environmentId": "uuid",
  "title": "High database error rate",
  "description": "Database errors exceeded threshold",
  "severity": "P1"
}
```

Manual incident creation must still validate tenant ownership.

---

# 23. Get Incident

```text
GET /api/v1/incidents/:incidentId
```

Response should include:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "High database error rate",
    "status": "INVESTIGATING",
    "severity": "P1",
    "service": {},
    "environment": {},
    "timeline": [],
    "aiAnalysis": null
  }
}
```

---

# 24. Update Incident

```text
PATCH /api/v1/incidents/:incidentId
```

Possible fields:

```json
{
  "status": "INVESTIGATING",
  "severity": "P1",
  "assignedToUserId": "uuid"
}
```

Only valid lifecycle transitions should be allowed.

---

# 25. Resolve Incident

```text
POST /api/v1/incidents/:incidentId/resolve
```

Request:

```json
{
  "resolution": "Database connection pool limit increased"
}
```

The incident should record:

```text
resolvedAt
status = RESOLVED
```

---

# 26. Incident Events

## Get Incident Events

```text
GET /api/v1/incidents/:incidentId/events
```

Optional filters:

```text
type
level
startTime
endTime
```

The endpoint should return events relevant to the incident timeline.

---

# 27. Incident Timeline

```text
GET /api/v1/incidents/:incidentId/timeline
```

Timeline may combine:

```text
Incident detected
Error spike
Deployment
AI analysis
Assignment
Status change
Mitigation
Resolution
```

Example:

```json
{
  "timestamp": "2026-09-01T12:30:00Z",
  "type": "DEPLOYMENT",
  "message": "Version 2.4.1 deployed"
}
```

---

# 28. AI Root Cause Analysis

## Trigger Analysis

```text
POST /api/v1/incidents/:incidentId/analyze
```

The endpoint should normally enqueue the analysis.

Response:

```json
{
  "success": true,
  "data": {
    "status": "QUEUED",
    "incidentId": "uuid"
  }
}
```

AI processing must happen asynchronously.

---

# 29. AI Analysis Result

## Get Analysis

```text
GET /api/v1/incidents/:incidentId/analysis
```

Example:

```json
{
  "success": true,
  "data": {
    "rootCause": "Database connection pool exhaustion",
    "confidence": 0.91,
    "evidence": [
      {
        "type": "LOG",
        "description": "Connection timeout errors increased significantly"
      },
      {
        "type": "DEPLOYMENT",
        "description": "Version 2.4.1 was deployed shortly before the incident"
      }
    ],
    "recommendations": [
      {
        "priority": "HIGH",
        "action": "Check database connection pool limits"
      }
    ]
  }
}
```

---

# 30. AI Confidence

AI confidence must be represented as a number between:

```text
0.0
```

and:

```text
1.0
```

Example:

```text
0.91 = 91%
```

The UI may display this as a percentage.

The value represents model confidence, not guaranteed correctness.

---

# 31. AI Evidence Rules

AI-generated analysis must distinguish:

```text
Observed Fact
Inference
Recommendation
```

Example:

```json
{
  "type": "OBSERVED",
  "description": "Error rate increased after deployment"
}
```

```json
{
  "type": "INFERENCE",
  "description": "The deployment may have introduced the failure"
}
```

```json
{
  "type": "RECOMMENDATION",
  "description": "Review the database connection configuration"
}
```

This improves explainability.

---

# 32. AI Incident Copilot

## Endpoint

```text
POST /api/v1/incidents/:incidentId/copilot
```

Request:

```json
{
  "message": "What should I investigate first?"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "answer": "Start by checking the database connection pool and the latest deployment.",
    "evidence": [],
    "suggestedActions": []
  }
}
```

The copilot must only receive data the authenticated user is authorized to access.

---

# 33. Deployments

## List Deployments

```text
GET /api/v1/deployments
```

Filters:

```text
serviceId
environmentId
status
startTime
endTime
```

## Create Deployment

```text
POST /api/v1/deployments
```

Request:

```json
{
  "serviceId": "uuid",
  "environmentId": "uuid",
  "version": "2.4.1",
  "commitSha": "abc123",
  "status": "SUCCESS"
}
```

---

# 34. Deployment Correlation

The backend should expose relevant deployments for an incident.

```text
GET /api/v1/incidents/:incidentId/deployments
```

The system can initially determine relevant deployments using a time window.

Example:

```text
Incident detected: 12:30
Search deployments:
12:00 → 12:30
```

Future versions can use more advanced correlation.

---

# 35. Dashboard

## Dashboard Summary

```text
GET /api/v1/dashboard/summary
```

Response:

```json
{
  "success": true,
  "data": {
    "activeIncidents": 4,
    "criticalIncidents": 1,
    "eventsToday": 152340,
    "servicesMonitored": 12,
    "resolvedIncidents": 28
  }
}
```

---

# 36. Dashboard Incident Trends

```text
GET /api/v1/dashboard/incidents/trends
```

Query:

```text
startTime
endTime
projectId
serviceId
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2026-09-01T10:00:00Z",
      "count": 4
    }
  ]
}
```

---

# 37. Dashboard Event Trends

```text
GET /api/v1/dashboard/events/trends
```

Response may contain:

```text
ERROR
WARNING
INFO
PERFORMANCE
```

grouped by time interval.

---

# 38. Audit Logs

## List Audit Logs

```text
GET /api/v1/organizations/:organizationId/audit-logs
```

Only authorized organization members may access appropriate audit records.

---

# 39. Health Check

## Endpoint

```text
GET /api/v1/health
```

Response:

```json
{
  "status": "ok",
  "service": "opspilot-api"
}
```

This endpoint should remain lightweight.

---

# 40. Readiness Check

Future deployment environments may use:

```text
GET /api/v1/health/ready
```

This endpoint may verify:

```text
PostgreSQL
Redis
Queue
```

A readiness failure should not necessarily mean the application process has crashed.

---

# 41. Error Response Format

All API errors should follow a consistent structure.

Example:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": []
  }
}
```

---

# 42. Common HTTP Status Codes

| Status | Meaning                                      |
| ------ | -------------------------------------------- |
| 200    | Successful request                           |
| 201    | Resource created                             |
| 202    | Request accepted for asynchronous processing |
| 204    | Successful request with no response body     |
| 400    | Invalid request                              |
| 401    | Unauthenticated                              |
| 403    | Forbidden                                    |
| 404    | Resource not found                           |
| 409    | Conflict                                     |
| 422    | Validation error                             |
| 429    | Rate limit exceeded                          |
| 500    | Internal server error                        |
| 503    | Service unavailable                          |

---

# 43. Error Codes

Use machine-readable error codes.

Examples:

```text
AUTH_REQUIRED
INVALID_CREDENTIALS
FORBIDDEN
RESOURCE_NOT_FOUND
VALIDATION_ERROR
RESOURCE_CONFLICT
API_KEY_INVALID
API_KEY_REVOKED
RATE_LIMIT_EXCEEDED
AI_SERVICE_UNAVAILABLE
DATABASE_ERROR
INTERNAL_ERROR
```

The frontend should use error codes rather than matching error-message strings.

---

# 44. Request Validation

Every incoming request must be validated.

Recommended approach:

```text
Zod
```

Validation must occur before business logic.

Example:

```text
Request
   ↓
Schema Validation
   ↓
Authentication
   ↓
Authorization
   ↓
Business Logic
```

Never trust:

```text
body
query
params
headers
```

without validation.

---

# 45. Rate Limiting

Rate limiting must be applied to sensitive endpoints.

Higher-priority endpoints include:

```text
/auth/login
/auth/register
/events
/events/batch
/incidents/:id/analyze
/incidents/:id/copilot
```

Redis should be used for distributed rate limiting.

Different limits may exist for:

```text
Authentication
Telemetry ingestion
AI requests
Normal API requests
```

---

# 46. Idempotency

Future high-value write endpoints should support idempotency.

Example:

```text
Idempotency-Key: 7d9e...
```

This is particularly useful for:

```text
Event ingestion
Deployment creation
Notifications
Billing operations
```

The initial implementation should prioritize event ingestion correctness.

---

# 47. API Security Rules

The backend must:

1. Validate all inputs.
2. Authenticate protected requests.
3. Authorize every tenant-owned resource.
4. Rate-limit sensitive endpoints.
5. Never trust frontend organization IDs.
6. Never expose database errors directly.
7. Never expose secrets.
8. Never log passwords or API keys.
9. Use secure cookies.
10. Use HTTPS in production.
11. Configure security headers.
12. Restrict CORS to approved frontend origins.
13. Apply request body size limits.
14. Validate uploaded content if file support is added.
15. Prevent mass-assignment vulnerabilities.

---

# 48. AI Service Communication

The Node.js backend communicates with the FastAPI AI service internally.

Conceptually:

```text
Express API
     │
     │ Internal authenticated request
     ▼
FastAPI AI Service
```

The frontend must never call:

```text
FastAPI directly
```

The AI service should authenticate internal requests using a secure service credential.

AI-service failures must be handled gracefully.

Example:

```text
AI unavailable
      │
      ▼
Incident remains available
      │
      ▼
User can retry analysis
```

AI is an enhancement to incident management, not a single point of failure.

---

# 49. Asynchronous API Operations

Operations that may take significant time should return:

```text
202 Accepted
```

Examples:

```text
POST /incidents/:id/analyze
POST /incidents/:id/copilot
POST /events/batch
```

depending on implementation.

The API should provide a way to retrieve processing status.

---

# 50. API Response Consistency

Successful responses should generally follow:

```json
{
  "success": true,
  "data": {}
}
```

Errors should follow:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

Do not return inconsistent response structures between controllers.

---

# 51. API Folder Structure

Recommended backend structure:

```text
apps/api/
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
│   └── app.ts
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
└── package.json
```

Routes should define HTTP endpoints.

Controllers should handle HTTP concerns.

Services should contain business logic.

Repositories should contain database access where repository abstraction is useful.

---

# 52. API Design Rules

The implementation must follow these principles:

1. Use RESTful resource naming.
2. Use plural resource names.
3. Keep URLs predictable.
4. Version public APIs.
5. Validate requests.
6. Return consistent responses.
7. Use appropriate HTTP status codes.
8. Keep controllers thin.
9. Keep business logic in services.
10. Never access Prisma directly from frontend code.
11. Never expose internal database implementation details.
12. Protect every tenant-owned resource.
13. Keep telemetry ingestion fast.
14. Move expensive work to workers.
15. Keep AI asynchronous where possible.

---

# 53. MVP API Scope

The first implementation must prioritize:

```text
Authentication
Organizations
Projects
Services
Environments
API Keys
Event Ingestion
Event Queries
Incidents
Incident Events
Deployments
AI Analysis
Dashboard
Health
```

The following are later enhancements:

```text
Slack
Email
PagerDuty
GitHub
Service Dependency Graph
Status Pages
Billing
Advanced Analytics
AI Remediation
```

## Phase 3 Authentication

The API uses a signed JWT stored in an HTTP-only cookie. The cookie is named
by `AUTH_COOKIE_NAME`, uses `SameSite=Lax`, and is marked `Secure` in
production. Tokens are never returned in response bodies or stored by the
frontend in browser storage.

Authentication endpoints are:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

Organization endpoints verify the authenticated user's membership before
returning tenant data:

```text
GET   /api/v1/organizations
GET   /api/v1/organizations/:organizationId
GET   /api/v1/organizations/:organizationId/members
PATCH /api/v1/organizations/:organizationId/members/:userId
```

Role checks are centralized and hierarchical: `OWNER` > `ADMIN` > `MEMBER` >
`VIEWER`. Role changes are owner-only and cannot remove the last organization
owner.

---

# 54. Final API Flow

Normal application request:

```text
Browser
   │
   ▼
Next.js
   │
   ▼
Express API
   │
   ├── Authenticate
   ├── Authorize
   ├── Validate
   ├── Execute business logic
   │
   ├──── PostgreSQL
   │
   └──── Redis / Queue
```

Telemetry request:

```text
Application
    │
    │ X-API-Key
    ▼
POST /api/v1/events
    │
    ├── Validate key
    ├── Validate payload
    ├── Rate limit
    └── Queue / persist
             │
             ▼
           Worker
             │
             ├── Detect anomaly
             ├── Create incident
             ├── Correlate events
             └── Trigger AI analysis
```

AI request:

```text
Incident
   │
   ▼
Context Retrieval
   │
   ├── Events
   ├── Deployments
   ├── Service
   ├── Environment
   └── Historical context
          │
          ▼
     FastAPI AI Service
          │
          ▼
 Structured AI Analysis
          │
          ▼
      PostgreSQL
          │
          ▼
      Dashboard
```

---

# 55. Critical API Rules for Antigravity

When implementing this API:

* Do not invent undocumented endpoints without updating this specification.
* Do not change response structures silently.
* Do not bypass tenant authorization.
* Do not expose API secrets.
* Do not put business logic in route files.
* Do not perform expensive AI work inside telemetry ingestion.
* Do not make the AI service a dependency for basic incident CRUD.
* Do not allow the frontend to access internal services directly.
* Do not add microservices without an architectural reason.
* Every new endpoint must have validation and authorization.
* Every important endpoint must have tests.
* Security must take priority over implementation speed.
