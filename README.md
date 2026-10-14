# OpsPilot AI

**AI-powered observability and incident intelligence platform** for
collecting application telemetry, detecting operational issues, managing
incidents, and generating AI-assisted root-cause analysis.

## Live Links

| Resource | Link |
| --- | --- |
| Live application | [https://opspilot-ai-eta.vercel.app](https://opspilot-ai-eta.vercel.app) |
| Login | [https://opspilot-ai-eta.vercel.app/login](https://opspilot-ai-eta.vercel.app/login) |
| Register | [https://opspilot-ai-eta.vercel.app/register](https://opspilot-ai-eta.vercel.app/register) |
| Backend API | [https://opspilot-ai-vbw8.onrender.com](https://opspilot-ai-vbw8.onrender.com) |
| API health check | [https://opspilot-ai-vbw8.onrender.com/api/v1/health](https://opspilot-ai-vbw8.onrender.com/api/v1/health) |
| API documentation | [docs/API.md](https://github.com/arpitbytes507/opspilot-ai/blob/main/docs/API.md) |
| GitHub repository | [arpitbytes507/opspilot-ai](https://github.com/arpitbytes507/opspilot-ai) |

**Frontend API base URL:** `https://opspilot-ai-vbw8.onrender.com/api/v1`

**AI service URL:** The FastAPI AI service is called by the backend for
incident analysis. Its public deployment URL was not available in the
project details used to prepare this README, so I have not invented one.
Add its public URL here if you want to expose a public health/docs link;
keep internal endpoints and keys private where appropriate.

## Overview

OpsPilot AI combines telemetry ingestion, asynchronous event processing,
rule-based incident detection, incident management, and AI-assisted
root-cause analysis in one web application.

## Key Features

- Authentication with secure HTTP-only cookie-based sessions.
- Organization-aware access control and role-based permissions.
- Project, service, and environment management.
- API-key-based telemetry ingestion with hashed key storage and key
  rotation/revocation.
- Redis-backed queue and background event processing.
- Rule-based incident detection and incident-event correlation.
- Incident status, severity, assignment, and audit history.
- AI-assisted root-cause analysis with analysis history.
- Dashboard summaries and service/environment health visibility.

## Architecture

```text
Next.js / React frontend (Vercel)
              |
           HTTPS API
              v
Express + TypeScript API (Render)
       |          |          |
       v          v          v
  PostgreSQL   Redis/Queue   FastAPI AI service
    (Neon)      (Upstash)    (incident analysis)
```

## Technology Stack

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js, React, TypeScript |
| Backend API | Node.js, Express, TypeScript |
| Database | PostgreSQL, Prisma |
| Queue and worker | Redis, BullMQ |
| AI service | Python, FastAPI |
| Validation and tests | Zod, Vitest, TypeScript checks |
| Hosting | Vercel, Render, Neon, Upstash |

## Telemetry API

**Endpoint:** `POST https://opspilot-ai-vbw8.onrender.com/api/v1/events`

Authenticate with an ingestion API key as described in the [API
documentation](https://github.com/arpitbytes507/opspilot-ai/blob/main/docs/API.md).
Ingestion keys use the `opspk_` prefix.

Example JSON payload:

```json
{
  "type": "ERROR",
  "level": "ERROR",
  "message": "Payment database connection timeout",
  "source": "payment-api",
  "metadata": {
    "environment": "production"
  }
}
```

An accepted/queued response means the API accepted the event; it does
not alone confirm that the worker finished processing it or that an
incident threshold was met. Confirm processing and detection in the
application and service logs.

## Local Development

### Prerequisites

- Node.js and pnpm compatible with the repository.
- Python for the AI service.
- PostgreSQL and Redis connection URLs.
- Environment variables required by the web app, API, and AI service.

### Start the monorepo

From the repository root:

```bash
pnpm install
pnpm dev
```

Follow the repository's configuration and scripts for environment setup.
Do not commit `.env` files or secrets.

### Run the AI service separately

From the AI service directory, activate the Python environment, install
project dependencies, and run:

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

This is a development command; production deployments should follow the
hosting platform's port and service configuration.

## Environment Configuration

Configure secrets in each hosting provider, not in source control.

- **Web app:** public API base URL should be
  `https://opspilot-ai-vbw8.onrender.com/api/v1`.
- **API:** configure the production database, Redis,
  session/authentication secret, allowed web origin, and AI-service
  connection/authentication settings expected by the code.
- **AI service:** configure the internal authentication key and any
  provider credentials required by the selected AI provider.

Use the exact environment-variable names defined in the source code.
Never expose private credentials through `NEXT_PUBLIC_*` variables.

## Production Verification Checklist

- Frontend loads and authentication works.
- API health endpoint responds successfully.
- Projects, services, and environments persist after refresh.
- Telemetry events are processed by the background worker.
- A scenario meeting a detection rule creates an incident.
- Incident updates and audit history work.
- AI root-cause analysis completes and appears in the incident UI.
- Organization isolation and role permissions prevent unauthorized
  access.
- Production secrets are not committed to the repository.

## Repository Structure

```text
opspilot-ai/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Express API and background worker
├── services/
│   └── ai-service/   # FastAPI AI service
├── packages/         # Shared packages
└── docs/
    └── API.md        # API documentation
```

## Security Notes

- Treat ingestion keys, auth/session secrets, database URLs, Redis
  URLs, and internal AI-service keys as credentials.
- Never commit secrets or include them in public logs, screenshots, or
  issue reports.
- Keep internal AI endpoints private unless public access is required
  and appropriately protected.
- Verify tenant isolation and role permissions before using real
  customer data.

## Future Improvements

Potential enhancements include alerting integrations, configurable
detection rules, additional telemetry sources, richer incident
correlation, and expanded automated test coverage.

## Author

**Arpit Sushant Dhumane**

GitHub: [https://github.com/arpitbytes507](https://github.com/arpitbytes507)

---

For bugs or suggestions, open an issue in the [GitHub
repository](https://github.com/arpitbytes507/opspilot-ai).