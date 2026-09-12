# OpsPilot AI — Product Specification

## 1. Product Overview

OpsPilot AI is a multi-tenant AI-powered incident intelligence platform for
software teams.

It helps engineering teams detect application incidents, understand their
root causes, manage incidents, and generate postmortem reports.

The product is designed for startups and engineering teams that need
production observability and incident intelligence without building a
complex internal platform.

---

## 2. Core Problem

Modern applications generate large amounts of logs, errors, metrics, and
deployment events.

When an application fails, developers often need to manually:

1. Identify that an incident has occurred.
2. Determine which service is affected.
3. Search through logs.
4. Check metrics.
5. Investigate recent deployments.
6. Identify the probable root cause.
7. Determine incident severity.
8. Notify the appropriate engineers.
9. Resolve the incident.
10. Document what happened.

This process can be slow and difficult, especially for small engineering
teams.

OpsPilot AI centralizes this workflow and uses AI to reduce investigation
time.

---

## 3. Target Users

### Primary Users

- Software developers
- DevOps engineers
- Site Reliability Engineers
- Engineering managers
- Startup technical teams

### Target Organizations

- Early-stage startups
- SaaS companies
- Small engineering teams
- Development teams operating multiple services

---

## 4. Core Product Workflow

Application
    ↓
Telemetry ingestion
    ↓
Event processing
    ↓
Anomaly detection
    ↓
Incident creation
    ↓
Incident correlation
    ↓
AI root-cause analysis
    ↓
Engineer investigation
    ↓
Resolution
    ↓
AI-generated postmortem

---

## 5. MVP Features

### Authentication

- User registration
- Login
- Logout
- Password hashing
- JWT/session authentication

### Organizations

- Create organization
- Organization membership
- Role-based access control
- Tenant isolation

### Projects

An organization can contain multiple projects.

Example:

Startup
├── Production
├── Staging
└── Development

### Services

A project can contain multiple services.

Example:

Project: E-commerce Platform

- Auth API
- Payment API
- User API
- Order API
- Notification Service

### API Keys

Each service can have an ingestion API key.

The key allows external applications to send telemetry events to OpsPilot.

### Event Ingestion

OpsPilot accepts application events such as:

- Errors
- Logs
- Warnings
- Performance events
- Deployment events

### Incidents

Incidents contain:

- Title
- Description
- Severity
- Status
- Affected service
- Detection time
- Resolution time
- Related events

### Dashboard

The dashboard displays:

- Service health
- Active incidents
- Error rates
- Recent events
- Incident history

---

## 6. AI Features

### Anomaly Detection

Detect unusual increases in:

- Error rate
- Request failures
- Latency
- Event frequency

### Root Cause Analysis

The AI analyzes related telemetry and deployment information to identify
probable causes.

### Incident Summary

AI generates a concise explanation of:

- What happened
- Which service was affected
- What changed
- Probable cause
- Impact

### Incident Copilot

Developers can ask questions about an incident.

Examples:

- Why is this service failing?
- What changed before the incident?
- Which service is most likely responsible?
- Are there similar incidents?
- What should I investigate next?

### Postmortem Generation

After an incident is resolved, OpsPilot can generate:

- Incident summary
- Timeline
- Root cause
- Impact
- Resolution
- Preventive actions

---

## 7. Future Features

These are not part of the initial MVP.

- Slack notifications
- Email alerts
- PagerDuty integration
- GitHub integration
- Deployment correlation
- Service dependency graph
- Similar incident detection
- Predictive incident detection
- AI remediation suggestions
- Automated rollback with explicit approval
- Organization billing
- Usage-based pricing
- Public status pages

---

## 8. Key Differentiator

OpsPilot is not simply an AI chatbot.

AI is integrated into the incident lifecycle.

The platform combines:

- Observability
- Event processing
- Incident management
- Machine learning
- AI reasoning
- Historical incident intelligence

The AI must use actual application telemetry and incident context rather
than providing generic answers.

---

## 9. Product Principles

### Reliability First

The monitoring platform must remain useful even if the AI service is
temporarily unavailable.

### AI as an Assistant

AI recommendations should be explainable and should not automatically
perform destructive actions.

### Security

Tenant data must remain isolated.

API keys and secrets must never be exposed.

### Scalability

The architecture should support increasing event volume without requiring
a complete redesign.

### Developer Experience

A developer should be able to integrate an application with OpsPilot using
a simple API.

---

## 10. MVP Success Criteria

The MVP is considered successful when a developer can:

1. Create an account.
2. Create an organization.
3. Create a project.
4. Create a service.
5. Generate an ingestion API key.
6. Send application events.
7. View events in the dashboard.
8. Trigger an incident from abnormal activity.
9. Investigate the incident.
10. Use AI to analyze the incident.
11. Resolve the incident.
12. Generate a postmortem.