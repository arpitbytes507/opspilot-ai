# OpsPilot AI — Database Specification

## 1. Purpose

This document defines the PostgreSQL database design for OpsPilot AI.

The database must support:

* Multi-tenant organizations
* Users and organization memberships
* Projects and services
* Multiple environments
* Secure ingestion API keys
* High-volume telemetry events
* Incidents and event correlation
* Deployments
* AI root-cause analyses
* AI-generated postmortems
* Audit logging
* Future scalability

PostgreSQL is the primary transactional database.

Redis is used for caching, rate limiting, queues, and temporary state. Redis is not the source of truth for persistent business data.

---

# 2. Database Principles

## 2.1 Multi-Tenancy

Every tenant-owned resource must belong to an organization directly or indirectly.

The organization is the primary tenant boundary.

Example:

```text
Organization
    │
    ├── Users / Memberships
    ├── Projects
    │      └── Services
    │             └── Environments
    │                    └── API Keys
    │
    ├── Events
    ├── Incidents
    ├── Deployments
    ├── AI Analyses
    └── Audit Logs
```

Backend authorization must verify organization ownership for every request.

The frontend must never be trusted to enforce tenant isolation.

---

# 3. ID Strategy

Use UUIDs for primary keys.

Example:

```text
id UUID PRIMARY KEY
```

UUIDs prevent predictable sequential identifiers and make distributed systems easier to scale later.

Application-generated UUIDs or PostgreSQL UUID generation may be used.

---

# 4. Common Fields

Most entities should contain:

```text
id
createdAt
updatedAt
```

Timestamp fields should use UTC.

Recommended database representation:

```text
TIMESTAMP WITH TIME ZONE
```

Example:

```text
createdAt = 2026-09-01T12:30:00Z
```

---

# 5. Users

The `users` table stores authenticated platform users.

## Fields

```text
User
--------------------------------
id
email
passwordHash
name
avatarUrl
isActive
lastLoginAt
createdAt
updatedAt
```

### Rules

* Email must be unique.
* Store only a secure password hash.
* Never store plaintext passwords.
* `isActive` allows account deactivation.
* `lastLoginAt` is optional.

### Indexes

```text
UNIQUE(email)
INDEX(email)
```

---

# 6. Organizations

An organization represents a customer/team using OpsPilot AI.

## Fields

```text
Organization
--------------------------------
id
name
slug
createdAt
updatedAt
```

Example:

```text
Acme Technologies
acme-technologies
```

### Rules

* `slug` must be unique.
* Organization is the main tenant boundary.

### Indexes

```text
UNIQUE(slug)
```

---

# 7. Organization Memberships

A user may belong to multiple organizations.

Therefore, users and organizations have a many-to-many relationship.

## Fields

```text
OrganizationMember
--------------------------------
id
organizationId
userId
role
createdAt
updatedAt
```

## Roles

```text
OWNER
ADMIN
MEMBER
VIEWER
```

### Relationship

```text
User
  │
  ├── OrganizationMember ── Organization
  │
  └── OrganizationMember ── Organization
```

### Constraints

```text
UNIQUE(organizationId, userId)
```

### Authorization

| Role   | Permissions                       |
| ------ | --------------------------------- |
| OWNER  | Full organization control         |
| ADMIN  | Manage team/projects/services     |
| MEMBER | Work with incidents and telemetry |
| VIEWER | Read-only access                  |

---

# 8. Projects

A project groups related services.

## Fields

```text
Project
--------------------------------
id
organizationId
name
slug
description
createdAt
updatedAt
```

### Relationship

```text
Organization
    │
    └── Projects
```

### Constraints

```text
UNIQUE(organizationId, slug)
```

This allows different organizations to have the same project slug.

Example:

```text
Organization A → payments
Organization B → payments
```

---

# 9. Services

A project may contain multiple services.

Examples:

```text
API
Frontend
Authentication Service
Payment Service
Notification Service
Worker
```

## Fields

```text
Service
--------------------------------
id
organizationId
projectId
name
slug
description
createdAt
updatedAt
```

### Relationships

```text
Organization
     │
     └── Project
           │
           ├── Service
           ├── Service
           └── Service
```

### Constraints

```text
UNIQUE(projectId, slug)
```

`organizationId` is also stored directly to make tenant-scoped queries and authorization checks efficient.

---

# 10. Service Environments

A single service can run in multiple environments.

Examples:

```text
production
staging
development
```

Therefore, environments should be represented separately.

## Fields

```text
ServiceEnvironment
--------------------------------
id
organizationId
serviceId
name
createdAt
updatedAt
```

Example:

```text
Payment API
    ├── production
    ├── staging
    └── development
```

### Constraints

```text
UNIQUE(serviceId, name)
```

This allows custom environments in the future.

---

# 11. API Keys

API keys are used by applications to send telemetry events to OpsPilot AI.

API keys belong to a specific service environment.

## Fields

```text
ApiKey
--------------------------------
id
organizationId
serviceEnvironmentId
name
keyPrefix
keyHash
lastUsedAt
expiresAt
revokedAt
createdAt
updatedAt
```

## Security

The complete API key must never be stored in plaintext.

Instead:

```text
Raw API Key
     │
     ▼
Hash
     │
     ▼
Database
```

Store:

```text
keyPrefix
keyHash
```

The prefix helps identify a key without exposing the secret.

Example:

```text
opsp_live_8F3A...
```

Only show the complete API key when it is initially created.

### Rules

* API keys can be revoked.
* API keys may optionally expire.
* API keys can be rotated.
* Requests must verify the key hash.
* API keys must never appear in logs.

---

# 12. Events

Events are the primary telemetry data entering OpsPilot AI.

## Event Types

```text
ERROR
WARNING
INFO
PERFORMANCE
DEPLOYMENT
```

Future types:

```text
SECURITY
DATABASE
NETWORK
CUSTOM
```

## Fields

```text
Event
--------------------------------
id
organizationId
projectId
serviceId
serviceEnvironmentId

type
level

message
source

timestamp

traceId
requestId

metadata
payload

createdAt
```

### Example

```json
{
  "type": "ERROR",
  "level": "ERROR",
  "message": "Database connection timeout",
  "source": "payment-service",
  "timestamp": "2026-09-01T12:30:00Z",
  "traceId": "abc123",
  "metadata": {
    "endpoint": "/api/payment",
    "statusCode": 500
  }
}
```

---

# 13. Event Data Strategy

Telemetry events may become the largest table in the system.

Therefore:

* Use efficient indexes.
* Avoid unnecessary joins during ingestion.
* Store flexible metadata using PostgreSQL JSONB.
* Keep ingestion lightweight.
* Process expensive analysis asynchronously.
* Consider partitioning when event volume becomes large.
* Consider archival/storage outside PostgreSQL for historical high-volume telemetry in later versions.

The MVP may store events directly in PostgreSQL.

Do not prematurely introduce a separate analytics database.

---

# 14. Event Indexes

Important indexes:

```text
INDEX(organizationId, createdAt)
INDEX(projectId, createdAt)
INDEX(serviceId, timestamp)
INDEX(serviceEnvironmentId, timestamp)
INDEX(organizationId, type, timestamp)
INDEX(traceId)
INDEX(requestId)
```

For large datasets, indexes should be reviewed using actual query patterns.

Do not create indexes for every column automatically.

---

# 15. Incidents

An incident represents a detected or manually created operational problem.

## Fields

```text
Incident
--------------------------------
id
organizationId
projectId
serviceId
serviceEnvironmentId

title
description

status
severity

detectedAt
startedAt
mitigatedAt
resolvedAt

assignedToUserId

rootCause
rootCauseConfidence

createdAt
updatedAt
```

---

# 16. Incident Status

Use the following lifecycle:

```text
DETECTED
OPEN
INVESTIGATING
MITIGATED
RESOLVED
POSTMORTEM
```

Example lifecycle:

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

---

# 17. Incident Severity

Use four severity levels:

```text
P1
P2
P3
P4
```

Meaning:

| Severity | Meaning                    |
| -------- | -------------------------- |
| P1       | Critical production outage |
| P2       | Major production impact    |
| P3       | Moderate impact            |
| P4       | Low impact / minor issue   |

Severity may initially be determined by deterministic rules and later enriched by AI.

---

# 18. Incident Events

An incident may contain many events.

Use a separate relationship table.

## Fields

```text
IncidentEvent
--------------------------------
id
incidentId
eventId
createdAt
```

### Relationship

```text
Incident
   │
   ├── Event
   ├── Event
   ├── Event
   └── Event
```

### Constraint

```text
UNIQUE(incidentId, eventId)
```

This allows future correlation systems to associate events with incidents without modifying the event itself.

---

# 19. Deployments

Deployments are important for identifying whether a recent code release caused an incident.

## Fields

```text
Deployment
--------------------------------
id
organizationId
projectId
serviceId
serviceEnvironmentId

version
commitSha

status

deployedByUserId

startedAt
completedAt

metadata

createdAt
updatedAt
```

## Deployment Status

```text
STARTED
SUCCESS
FAILED
ROLLED_BACK
```

Example:

```text
10:00 → Deployment v2.4.1
10:05 → Error rate increases
10:07 → Incident detected
```

OpsPilot AI can use this temporal relationship during root-cause analysis.

---

# 20. AI Analyses

AI analysis stores AI-generated reasoning associated with an incident.

## Fields

```text
AIAnalysis
--------------------------------
id
organizationId
incidentId

analysisType

rootCause
confidence

evidence
recommendations

model
modelVersion

promptVersion

inputTokens
outputTokens

processingTimeMs

createdAt
updatedAt
```

## Analysis Types

```text
ROOT_CAUSE
INCIDENT_SUMMARY
RECOMMENDATION
POSTMORTEM
```

---

# 21. AI Evidence

AI should distinguish between observed evidence and inference.

Store evidence as structured JSON.

Example:

```json
[
  {
    "type": "LOG",
    "description": "Database connection timeout increased",
    "eventId": "uuid"
  },
  {
    "type": "DEPLOYMENT",
    "description": "Version 2.4.1 deployed 4 minutes before incident",
    "deploymentId": "uuid"
  }
]
```

This allows the UI to explain why the AI reached a conclusion.

---

# 22. AI Recommendations

Recommendations should also be structured.

Example:

```json
[
  {
    "priority": "HIGH",
    "action": "Check database connection pool limits"
  },
  {
    "priority": "MEDIUM",
    "action": "Review deployment 2.4.1"
  }
]
```

AI recommendations must not automatically execute destructive operations.

---

# 23. Postmortems

The initial MVP may store postmortem information in `AIAnalysis` using:

```text
analysisType = POSTMORTEM
```

A dedicated `Postmortem` table can be introduced later if postmortems require collaborative editing, approvals, comments, or version history.

This avoids unnecessary complexity in the MVP.

---

# 24. Audit Logs

Important security and administrative actions should be recorded.

## Fields

```text
AuditLog
--------------------------------
id
organizationId
userId

action
resourceType
resourceId

ipAddress
userAgent

metadata

createdAt
```

Example actions:

```text
USER_INVITED
ROLE_CHANGED
API_KEY_CREATED
API_KEY_REVOKED
PROJECT_CREATED
SERVICE_CREATED
INCIDENT_UPDATED
INCIDENT_RESOLVED
```

Audit logs are append-only.

Application code should not update old audit records.

---

# 25. Entity Relationships

The main relationship structure is:

```text
User
 │
 └── OrganizationMember
          │
          ▼
     Organization
          │
          ├───────────────┐
          │               │
          ▼               ▼
       Project         AuditLog
          │
          ▼
       Service
          │
          ▼
 ServiceEnvironment
          │
          ├── API Keys
          │
          ├── Events
          │
          ├── Incidents
          │
          └── Deployments
```

Incident relationships:

```text
Incident
   │
   ├── IncidentEvent ── Event
   │
   └── AIAnalysis
```

---

# 26. Tenant Isolation Rules

Every request involving tenant-owned data must follow this pattern:

```text
Authenticated User
        │
        ▼
Organization Membership
        │
        ▼
Requested Resource
        │
        ▼
Verify organization ownership
        │
        ▼
Allow / Reject
```

Never do:

```text
GET /projects/:projectId
```

and blindly query:

```sql
SELECT * FROM projects WHERE id = :projectId;
```

Instead, tenant context must be included.

Conceptually:

```sql
SELECT *
FROM projects
WHERE id = :projectId
AND organization_id = :organizationId;
```

This rule applies throughout the backend.

---

# 27. Foreign Key Rules

Use foreign keys to maintain referential integrity.

Examples:

```text
OrganizationMember.organizationId
    → Organization.id

OrganizationMember.userId
    → User.id

Project.organizationId
    → Organization.id

Service.projectId
    → Project.id

ServiceEnvironment.serviceId
    → Service.id

ApiKey.serviceEnvironmentId
    → ServiceEnvironment.id

Event.serviceEnvironmentId
    → ServiceEnvironment.id

Incident.serviceEnvironmentId
    → ServiceEnvironment.id

Deployment.serviceEnvironmentId
    → ServiceEnvironment.id

AIAnalysis.incidentId
    → Incident.id
```

Use appropriate `ON DELETE` behavior.

Avoid cascading deletion of large telemetry datasets accidentally.

---

# 28. Soft Deletion

Soft deletion should only be used where useful.

For important business resources such as:

```text
Organization
Project
Service
User
```

a future `deletedAt` field may be introduced.

Telemetry events and audit logs should generally not be casually deleted.

For the MVP, soft deletion can be implemented only where the product requires recovery/deactivation.

---

# 29. JSONB Usage

PostgreSQL JSONB can be used for flexible data such as:

```text
Event.metadata
Event.payload
Deployment.metadata
AIAnalysis.evidence
AIAnalysis.recommendations
AuditLog.metadata
```

JSONB must not replace normal relational columns for frequently queried core fields.

Bad:

```text
event.payload.organizationId
```

Better:

```text
event.organizationId
```

and keep additional arbitrary information in:

```text
event.payload
```

---

# 30. Database Performance

The database must be designed around actual access patterns.

Common queries include:

```text
Get organization incidents
Get active incidents
Get recent events
Get service events
Get events around an incident
Get recent deployments
Get AI analysis for incident
Get project services
Get organization members
```

Indexes should support these queries.

High-volume telemetry queries should always be tenant-scoped and time-bounded.

Avoid queries that scan the complete event table.

---

# 31. Event Retention

Telemetry retention should eventually become configurable.

Possible future settings:

```text
7 days
30 days
90 days
180 days
1 year
```

When retention is introduced:

```text
PostgreSQL
    │
    ├── Recent events
    │
    └── Archive / analytics storage
```

The MVP does not require a separate archival system.

---

# 32. Future Database Extensions

The schema should allow future additions such as:

```text
ServiceDependency
AlertRule
NotificationChannel
Notification
IncidentComment
IncidentTimeline
IncidentAssignment
Metric
MetricSnapshot
Trace
ErrorGroup
SavedQuery
Dashboard
Integration
GitHubRepository
SlackIntegration
BillingAccount
Subscription
UsageRecord
StatusPage
```

These should only be added when the corresponding product feature is implemented.

---

# 33. Prisma

Prisma should be used as the ORM for the Node.js backend.

The expected location is:

```text
apps/api/prisma/schema.prisma
```

The schema should be generated from this document and reviewed before migrations are applied.

Recommended workflow:

```text
Database Design
      ↓
Prisma Schema
      ↓
Migration
      ↓
Seed Data
      ↓
Integration Tests
```

Never modify the production database manually when a migration should be used.

---

# 34. Seed Data

Development seed data should include:

```text
1 demo organization
2–3 users
1 project
2–3 services
production + staging environments
API keys
sample events
sample incidents
sample deployments
sample AI analyses
```

Seed data must be clearly marked as development/demo data.

Never use real credentials or API keys in seed files.

---

# 35. MVP Database Scope

The first implementation should contain:

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

Do not implement future tables until their features are required.

---

# 36. Final Database Architecture

The initial database architecture is:

```text
                    PostgreSQL
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
   Identity          Product Data       Telemetry
       │                 │                 │
     Users          Projects          Events
     Members        Services
                    Incidents
                    Deployments
                    AIAnalysis
                    AuditLogs
```

Redis operates alongside PostgreSQL:

```text
                ┌───────────────┐
                │   Express API │
                └───────┬───────┘
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
       PostgreSQL               Redis
       Source of Truth      Cache / Queue /
                            Rate Limiting
```

---

# 37. Critical Rules

The implementation must follow these rules:

1. Every tenant-owned resource must be organization-scoped.
2. Never trust organization IDs supplied by the frontend.
3. Never store plaintext passwords.
4. Never store plaintext API keys.
5. Never log API keys or secrets.
6. Use UUID primary keys.
7. Use UTC timestamps.
8. Use foreign keys for relational integrity.
9. Use JSONB only for genuinely flexible data.
10. Keep telemetry ingestion lightweight.
11. Move expensive processing to workers.
12. AI analysis must not block incident creation.
13. Audit logs must be append-only.
14. Avoid accidental cascading deletion of telemetry.
15. Do not introduce additional databases until actual scale requires them.
16. Use migrations for schema changes.
17. Test tenant isolation explicitly.
18. Index based on real query patterns.
19. Keep AI-generated conclusions separate from observed telemetry evidence.
20. Never allow AI to perform destructive production actions automatically.
