# OpsPilot AI — System Architecture

## 1. Architecture Goal

OpsPilot AI is designed as a modular, scalable SaaS platform for application observability and AI-powered incident intelligence.

The initial implementation should use a modular architecture rather than premature microservices.

Independent services and background workers should be introduced only when there is a clear scalability, reliability, or isolation benefit.

The architecture should prioritize:

* Maintainability
* Security
* Tenant isolation
* Reliability
* Scalability
* Developer experience
* Clear separation of responsibilities

---

# 2. High-Level Architecture

```text
                         INTERNET
                            │
                            ▼
                  ┌───────────────────┐
                  │     Next.js       │
                  │     Web App       │
                  └─────────┬─────────┘
                            │ HTTPS
                            ▼
                  ┌───────────────────┐
                  │   Express API     │
                  │   TypeScript      │
                  └─────────┬─────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
     PostgreSQL           Redis          Event Queue
          │                 │                 │
          │                 │                 ▼
          │                 │           Background Worker
          │                 │                 │
          │                 │                 ▼
          │                 │           AI Service
          │                 │            FastAPI
          │                 │                 │
          └─────────────────┴─────────────────┘
```

---

# 3. Frontend

## Technology

* Next.js
* TypeScript
* Tailwind CSS
* shadcn/ui
* TanStack Query
* Recharts

## Responsibilities

The frontend is responsible for:

* Authentication UI
* Organization management
* Project management
* Service management
* Incident dashboard
* Event explorer
* Service health
* AI incident analysis
* Incident timeline
* Postmortem interface
* Settings

The frontend must not directly communicate with PostgreSQL.

All application data must be accessed through the backend API.

The frontend must never be trusted for authorization or tenant isolation.

---

# 4. Backend API

## Technology

* Node.js
* TypeScript
* Express

## Responsibilities

The backend owns the primary business logic.

It handles:

* Authentication
* Authorization
* Organizations
* Organization memberships
* Projects
* Services
* API keys
* Events
* Incidents
* Incident management
* User management
* Audit logs
* API validation

The backend is the primary entry point for the web application.

---

# 5. API Versioning

All public API endpoints must use versioning.

Example:

```text
/api/v1/auth/login
/api/v1/organizations
/api/v1/projects
/api/v1/services
/api/v1/incidents
/api/v1/events
```

Future breaking API changes should use a new version.

Example:

```text
/api/v2/events
```

---

# 6. Database

## Technology

PostgreSQL

PostgreSQL is the primary source of truth for transactional data.

Database access should use Prisma.

The database stores:

* Users
* Organizations
* Organization memberships
* Projects
* Services
* API keys
* Events
* Incidents
* Incident-event relationships
* Deployment events
* AI analysis records
* Audit logs

The database must enforce appropriate indexes and relationships.

---

# 7. Multi-Tenancy

OpsPilot is a multi-tenant SaaS application.

The organization is the primary tenant boundary.

Every tenant-owned record must contain an organization relationship either directly or through a parent entity.

Example:

```text
Organization
    │
    ├── Members
    │
    ├── Projects
    │      │
    │      └── Services
    │
    ├── Events
    │
    ├── Incidents
    │
    └── Audit Logs
```

A user belonging to Organization A must never be able to access data belonging to Organization B.

Tenant isolation must be enforced on the backend.

The frontend must never be trusted to enforce tenant isolation.

Every request accessing tenant-owned resources must verify:

1. The user is authenticated.
2. The user belongs to the organization.
3. The user has sufficient permissions.
4. The requested resource belongs to that organization.

---

# 8. Authentication

Authentication will initially use:

* Secure password hashing
* HTTP-only cookies where appropriate
* JWT or secure session-based authentication
* Refresh token rotation if refresh tokens are implemented

Passwords must never be stored in plaintext.

Authentication logic must be isolated from business logic.

Authentication credentials must never be returned unnecessarily in API responses.

---

# 9. Authorization

OpsPilot will use role-based access control.

Initial roles:

```text
OWNER
ADMIN
MEMBER
VIEWER
```

## OWNER

Permissions:

* Full organization access
* Manage organization
* Manage members
* Manage projects
* Manage services
* Manage API keys
* Manage billing in future versions
* Delete organization

## ADMIN

Permissions:

* Manage projects
* Manage services
* Manage incidents
* Manage members
* Manage API keys

## MEMBER

Permissions:

* View incidents
* Investigate incidents
* Create incidents
* Update incidents
* Resolve incidents

## VIEWER

Permissions:

* Read-only access
* View incidents
* View events
* View service health

Authorization must be implemented on the backend.

---

# 10. Event Ingestion

External applications send telemetry to OpsPilot through an ingestion endpoint.

Example:

```text
POST /api/v1/events
```

Authentication uses a service-specific ingestion API key.

Example request:

```json
{
  "service": "payment-api",
  "environment": "production",
  "level": "error",
  "message": "Database connection timeout",
  "timestamp": "2026-09-12T20:30:00Z"
}
```

The ingestion API should be lightweight.

It should:

1. Authenticate the API key.
2. Validate the request.
3. Identify the organization.
4. Identify the service.
5. Enqueue or persist the event.
6. Return quickly.

Heavy processing must not block the ingestion request.

---

# 11. Event Types

The initial event model should support:

```text
ERROR
WARNING
INFO
PERFORMANCE
DEPLOYMENT
```

Future event types may include:

```text
SECURITY
DATABASE
NETWORK
CUSTOM
```

The event model should be extensible without requiring major architectural changes.

---

# 12. Event Processing

The event pipeline is:

```text
External Application
        │
        ▼
    Event API
        │
        ▼
     Validate
        │
        ▼
      Queue
        │
        ▼
 Background Worker
        │
        ├── Store event
        ├── Update metrics
        ├── Detect anomalies
        └── Evaluate incidents
```

The ingestion API must not directly perform expensive AI operations.

The system should process telemetry asynchronously.

---

# 13. Redis

Redis will be used for:

* Caching
* Rate limiting
* Queue infrastructure
* Temporary processing state
* Short-lived distributed locks where required

Redis must not become the primary source of truth for permanent business data.

If Redis becomes unavailable, core transactional data must remain safe in PostgreSQL.

---

# 14. Background Workers

Workers process tasks asynchronously.

Examples:

```text
Event processing
Anomaly detection
Incident correlation
AI analysis
Postmortem generation
Email notifications
```

Workers must be designed to safely retry failed jobs.

Jobs should be idempotent whenever possible.

Failed jobs should eventually be moved to a dead-letter queue or equivalent failure store.

---

# 15. AI Service

## Technology

* Python
* FastAPI
* LangGraph
* Machine learning libraries
* LLM provider

The AI service is isolated from the main Node.js API.

The AI service is responsible for:

* Anomaly analysis
* Root-cause analysis
* Incident summarization
* Incident Copilot
* Similar incident analysis
* Postmortem generation

The AI service should not directly access authentication data.

Business authorization remains the responsibility of the Node.js backend.

---

# 16. AI Architecture

The AI pipeline should not simply send the user's question directly to an LLM.

Instead:

```text
Incident
   │
   ▼
Context Retrieval
   │
   ├── Related Logs
   ├── Metrics
   ├── Deployments
   ├── Service Information
   └── Historical Incidents
          │
          ▼
    Context Builder
          │
          ▼
       AI Agent
          │
          ▼
   Structured Analysis
          │
          ▼
      API Response
```

AI responses should be grounded in actual OpsPilot data.

The AI should clearly distinguish between:

* Observed facts
* Inferred causes
* Recommendations

---

# 17. AI Agent Workflow

The AI agent may use a LangGraph workflow.

Example:

```text
START
  │
  ▼
Load Incident
  │
  ▼
Retrieve Related Events
  │
  ▼
Check Recent Deployments
  │
  ▼
Analyze Error Patterns
  │
  ▼
Generate Root Cause Candidates
  │
  ▼
Evaluate Confidence
  │
  ▼
Generate Recommendations
  │
  ▼
END
```

The AI should provide confidence and supporting evidence when possible.

AI output must be validated before being returned to the frontend.

---

# 18. AI Output Contract

The AI service should return structured output rather than uncontrolled text.

Example:

```json
{
  "rootCause": "Database connection pool exhaustion",
  "confidence": 0.91,
  "evidence": [
    "Database connection usage increased after deployment",
    "Payment API latency increased",
    "Connection timeout errors increased"
  ],
  "recommendations": [
    "Inspect connection pool configuration",
    "Review deployment changes",
    "Check database connection limits"
  ]
}
```

The backend should validate this structure before storing or returning it.

---

# 19. Incident Lifecycle

An incident follows:

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

Not every incident must pass through every state.

Example:

```text
OPEN → RESOLVED
```

is allowed for simple incidents.

Incident state transitions should be validated by the backend.

---

# 20. Incident Detection

The first detection engine should use deterministic rules and statistical methods before introducing complex AI.

Examples:

```text
Error rate > threshold
Latency > threshold
Event frequency anomaly
Repeated identical errors
Sudden service failure
```

This provides a predictable baseline.

AI can then enrich the detected incident with:

* Root-cause hypotheses
* Evidence
* Severity recommendations
* Investigation suggestions

AI should not be the only mechanism responsible for detecting incidents.

---

# 21. Incident Severity

Initial severity levels:

```text
P1 — Critical
P2 — High
P3 — Medium
P4 — Low
```

Example:

```text
P1:
Major production outage
Large user impact
Critical business functionality unavailable

P2:
Major degradation
Limited but significant user impact

P3:
Moderate issue
Limited functionality affected

P4:
Minor issue
Low business impact
```

Severity may initially be determined through deterministic rules and later enriched by AI.

---

# 22. Incident Correlation

Multiple events may belong to the same incident.

Example:

```text
Error #182
Error #183
Error #184
Error #185
       │
       ▼
Incident #52
```

Correlation may consider:

* Service
* Environment
* Time window
* Error type
* Error message similarity
* Related deployments
* Dependency relationships

The correlation engine should avoid creating unnecessary duplicate incidents.

---

# 23. Service Dependency Graph

Future versions will maintain relationships between services.

Example:

```text
Frontend
   │
   ▼
API Gateway
   │
   ├──────────► Auth Service
   │
   ├──────────► Order Service
   │                 │
   │                 ▼
   │            Payment Service
   │                 │
   │                 ▼
   │             Database
```

This will help determine how failures propagate through the system.

The dependency graph can later be used by the AI root-cause engine.

---

# 24. Deployment Correlation

Future versions should integrate with GitHub or other CI/CD systems.

Example:

```text
10:38 PM
Deployment #842
       │
       ▼
10:40 PM
Latency ↑
       │
       ▼
10:41 PM
Errors ↑
       │
       ▼
10:42 PM
Incident Created
```

The AI should use deployment history as evidence during root-cause analysis.

---

# 25. Incident Copilot

Developers should be able to ask questions about an incident.

Examples:

```text
Why is the payment API failing?

What changed before the incident?

Which service is probably responsible?

Are there similar incidents?

What should I investigate next?

Generate a postmortem.
```

The Copilot must use incident-specific context.

It should not behave like a generic chatbot.

---

# 26. Postmortem Generation

After an incident is resolved, the AI can generate:

* Incident summary
* Timeline
* Root cause
* Impact
* Resolution
* Preventive actions

Example:

```text
INCIDENT #1042

Title:
Payment API Database Failure

Duration:
24 minutes

Severity:
P1

Root Cause:
Database connection pool exhaustion

Impact:
12,840 requests affected

Timeline:
10:38 Deployment
10:40 Latency increased
10:41 DB connections increased
10:42 Incident triggered
11:06 Resolved

Resolution:
Connection pool configuration was corrected and
the problematic deployment was rolled back.

Prevention:
- Add connection pool monitoring
- Add deployment validation
- Configure database connection limits
```

Postmortems should remain editable by humans.

---

# 27. Notifications

Future notification channels:

* Email
* Slack
* Microsoft Teams
* PagerDuty

Notifications should be processed asynchronously.

Notification failures must not prevent incident creation.

---

# 28. Rate Limiting

Public API endpoints and event ingestion endpoints must be rate limited.

Different limits may be applied to:

* Authentication endpoints
* Web application API
* Event ingestion
* AI requests

Rate limits should be enforced server-side.

Limits should eventually be configurable by organization or subscription plan.

---

# 29. API Security

All API endpoints must follow these principles:

* Validate all external input.
* Authenticate protected endpoints.
* Authorize tenant-owned resources.
* Rate-limit public endpoints.
* Never trust organization IDs supplied by clients.
* Never expose internal secrets.
* Never return passwords or sensitive credentials.
* Use HTTPS in production.
* Use secure HTTP headers.
* Log security-relevant events.

---

# 30. API Key Security

Service ingestion keys are sensitive credentials.

The system should:

* Generate cryptographically secure keys.
* Store only a secure representation when possible.
* Display the complete key only when appropriate.
* Allow key rotation.
* Allow key revocation.
* Associate each key with exactly one service.
* Record key usage where appropriate.

API keys must never be committed to Git.

---

# 31. Secrets Management

Secrets must never be stored in source code.

Development should use environment variables.

Example:

```text
DATABASE_URL
REDIS_URL
JWT_SECRET
AI_API_KEY
```

Local environment files such as:

```text
.env
.env.local
```

must be excluded from Git.

Production secrets must be stored using the deployment platform's secure secret-management mechanism.

---

# 32. Observability of OpsPilot

OpsPilot itself must be observable.

The platform should eventually monitor:

* API latency
* API error rate
* Worker failures
* Queue depth
* Database performance
* AI latency
* AI failures
* Event ingestion throughput
* Memory usage
* CPU usage

This allows OpsPilot to demonstrate the same observability capabilities that it provides to customers.

---

# 33. Logging

Application logs should use structured logging.

Example:

```json
{
  "timestamp": "2026-09-12T20:30:00Z",
  "level": "error",
  "service": "api",
  "requestId": "req_123",
  "message": "Database connection failed"
}
```

Sensitive information must not be logged.

Examples of information that must not appear in logs:

* Passwords
* Authentication tokens
* API keys
* Secret values

---

# 34. Request Tracing

Future versions should support request correlation.

Example:

```text
Request ID:
req_18482

Frontend
   ↓
API Gateway
   ↓
Order Service
   ↓
Payment Service
   ↓
Database
```

The same request identifier should be propagated across internal operations where practical.

This will help diagnose distributed failures.

---

# 35. Reliability

Important operations should support:

* Retries
* Idempotency
* Timeouts
* Error handling

# 36. Phase 4 Resource Management

The organization-scoped resource hierarchy is implemented in the Express API:

```text
Organization -> Project -> Service -> ServiceEnvironment -> ApiKey
```

The API verifies the authenticated user's membership before resolving any nested resource. Resource authorization then checks every parent relationship in the query, preventing IDs from another organization, project, or service from being used as a shortcut. Project, service, and environment deletion is blocked when historical or dependent records exist.

API keys are high-entropy `opspk_` secrets. The database stores only a display prefix and SHA-256 hash. Creation and rotation return the full secret once; list and detail responses contain metadata only. Rotation revokes the prior record and creates a new one. Audit logs record resource actions and prefixes, never secrets or hashes.
* Dead-letter queues
* Health checks

AI failures must not prevent normal incident management.

If AI is unavailable, users should still be able to:

* View incidents
* View events
* Update incident status
* Investigate incidents
* Resolve incidents

---

# 36. Health Checks

Services should expose health endpoints.

Example:

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

Infrastructure health checks should distinguish between:

```text
Liveness
Readiness
```

---

# 37. Scalability Strategy

## Initial Architecture

```text
Next.js
    │
    ▼
Express API
    │
    ├── PostgreSQL
    └── Redis
```

The initial backend should remain relatively simple.

---

## Increased Traffic

As traffic grows:

```text
                 Load Balancer
                       │
            ┌──────────┼──────────┐
            ▼          ▼          ▼
          API 1      API 2      API 3
            │          │          │
            └──────────┼──────────┘
                       │
                     Redis
                       │
                     Queue
                       │
              ┌────────┼────────┐
              ▼        ▼        ▼
           Worker 1 Worker 2 Worker 3
```

API servers should remain stateless so they can scale horizontally.

Workers should scale independently based on queue depth and workload.

---

# 38. Database Scalability

Initial strategy:

```text
Application
     │
     ▼
PostgreSQL
```

As traffic grows:

```text
Application
     │
     ▼
Connection Pool
     │
     ▼
PostgreSQL
```

Future possibilities include:

* Read replicas
* Partitioning large event tables
* Time-based event archival
* Database indexing optimization
* Separate analytical storage

These should only be introduced after measuring an actual bottleneck.

---

# 39. Event Data Scalability

Telemetry events may grow much faster than normal business data.

Therefore, event storage should be designed differently from transactional data.

Future strategies may include:

```text
Recent Events
     ↓
PostgreSQL

Older Events
     ↓
Object Storage / Analytical Store
```

The system should eventually support retention policies.

Example:

```text
Free:
7 days

Pro:
30 days

Enterprise:
90+ days
```

Retention policies are a future feature.

---

# 40. AI Scalability

AI requests should not block normal API requests.

Instead:

```text
Incident
   │
   ▼
AI Analysis Job
   │
   ▼
Queue
   │
   ▼
AI Worker
   │
   ▼
FastAPI AI Service
   │
   ▼
LLM / ML Model
```

Multiple AI workers can process jobs concurrently.

AI requests should have:

* Timeouts
* Retry limits
* Rate limits
* Error handling
* Usage tracking

---

# 41. AI Cost Control

AI usage can become expensive as the platform grows.

Future safeguards should include:

* Token limits
* Request rate limits
* Context-size limits
* Caching
* Model selection based on task complexity
* Usage tracking per organization

Example:

```text
Simple summary
     ↓
Smaller/cheaper model

Complex root-cause analysis
     ↓
More capable model
```

---

# 42. Caching Strategy

Redis caching may be used for data that is expensive to repeatedly retrieve.

Possible cached data:

* Service metadata
* Organization configuration
* Dashboard summaries
* Frequently requested incident information

Cache invalidation must be handled carefully.

PostgreSQL remains the source of truth.

---

# 43. Deployment Architecture

Initial deployment should support:

```text
                    Internet
                       │
                       ▼
                  Next.js App
                       │
                       ▼
                  Express API
                    /     \
                   /       \
                  ▼         ▼
            PostgreSQL     Redis
                              │
                              ▼
                            Queue
                              │
                              ▼
                           Worker
                              │
                              ▼
                         FastAPI AI
```

Each component may be deployed independently when required.

---

# 44. CI/CD

The repository should eventually use GitHub Actions.

Pipeline:

```text
Git Push
   │
   ▼
GitHub Actions
   │
   ├── Install dependencies
   ├── Lint
   ├── Type check
   ├── Unit tests
   ├── Integration tests
   └── Build
          │
          ▼
       Deployment
```

Pull requests should run automated validation before merging.

---

# 45. Testing Strategy

Testing should exist at multiple levels.

## Unit Tests

Test:

* Business logic
* Utility functions
* Detection rules
* Permission checks

## Integration Tests

Test:

* API + database
* Authentication
* Tenant isolation
* Event ingestion
* Incident creation

## End-to-End Tests

Test:

```text
Login
  ↓
Create organization
  ↓
Create project
  ↓
Create service
  ↓
Generate API key
  ↓
Send event
  ↓
Incident created
  ↓
AI analysis
  ↓
Resolve incident
  ↓
Generate postmortem
```

---

# 46. Tenant Isolation Testing

Tenant isolation is a critical security requirement.

Tests must verify:

```text
Organization A
      X
      │
      └──── cannot access ────► Organization B
```

This should be explicitly tested at the API level.

---

# 47. Performance Testing

Performance should be measured rather than assumed.

Important metrics:

```text
API response time
Event ingestion throughput
Queue processing latency
Database query latency
AI response latency
Dashboard load time
```

Load testing should eventually be used to establish real capacity numbers.

---

# 48. Scalability Principle

Do not introduce infrastructure merely because it sounds scalable.

Every technology must solve a demonstrated problem.

Preferred progression:

```text
Simple
  ↓
Measure
  ↓
Identify bottleneck
  ↓
Optimize
  ↓
Scale
```

The goal is maintainable scalability rather than unnecessary architectural complexity.

---

# 49. Development Rules for AI Coding Agents

AI coding agents such as Antigravity must follow these rules.

## Rule 1 — Read Documentation First

Before modifying the project, read:

```text
docs/PRODUCT.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API.md
docs/DEVELOPMENT.md
```

when those files exist.

## Rule 2 — Do Not Redesign Architecture Without Approval

The coding agent must not:

* Replace the selected framework
* Replace the database
* Introduce microservices unnecessarily
* Add infrastructure without justification
* Change API contracts without approval

## Rule 3 — Small Changes

Implement features in small, reviewable steps.

## Rule 4 — Explain Dependencies

Before introducing a major dependency, explain:

* Why it is needed
* What problem it solves
* Whether an existing dependency can solve the problem

## Rule 5 — Preserve Existing Functionality

New features must not unnecessarily break existing features.

## Rule 6 — Test Changes

Every meaningful backend change should include appropriate tests.

## Rule 7 — Security First

Never introduce:

* Hardcoded secrets
* Unsafe authentication
* Missing authorization
* Cross-tenant access
* Unvalidated input

## Rule 8 — No Fake Features

Do not create mock functionality that appears to work in production unless it is explicitly labeled as mock/demo functionality.

---

# 50. Architectural Decision Principle

Important architectural decisions should be documented.

Example:

```text
Decision:
Use PostgreSQL instead of MongoDB.

Reason:
The platform contains strongly related transactional entities such as
organizations, memberships, projects, services, incidents and events.
Relational constraints and transactions are valuable for tenant isolation
and data integrity.
```

Architectural decisions should be recorded when they have long-term impact.

---

# 51. Final Architecture Target

The long-term target architecture is:

```text
                           USERS
                             │
                             ▼
                    ┌─────────────────┐
                    │     Next.js     │
                    │   Web Client    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Express API    │
                    │   TypeScript    │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
     PostgreSQL            Redis            Event API
          │                  │                  │
          │                  │                  ▼
          │                  │                Queue
          │                  │                  │
          │                  │                  ▼
          │                  │              Workers
          │                  │                  │
          │                  │                  ▼
          │                  │             AI Service
          │                  │              FastAPI
          │                  │                  │
          │                  │                  ▼
          │                  │             AI / ML
          │                  │
          └──────────────────┴──────────────────┐
                                                 │
                                                 ▼
                                         Incident Intelligence
```

The architecture should evolve based on measured requirements rather than
premature complexity.

The primary goal is to build a reliable, secure, maintainable SaaS product
that can demonstrate real-world software engineering, AI integration,
distributed processing, and scalability.
