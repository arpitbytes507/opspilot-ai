# OpsPilot AI

OpsPilot AI is a multi-tenant SaaS platform for application observability, incident intelligence, and AI-assisted root cause analysis. This repository is being set up as a monorepo foundation for the product architecture described in the project docs.

## Architecture overview

The application is organized as follows:

- Web app: Next.js frontend at `apps/web`
- API: Express backend at `apps/api`
- AI service: FastAPI service at `services/ai-service`
- Shared library: TypeScript package at `packages/shared`

## Repository structure

```text
opspilot-ai/
├── apps/
│   ├── web/
│   └── api/
├── services/
│   └── ai-service/
├── packages/
│   └── shared/
├── docs/
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── README.md
└── pnpm-lock.yaml
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Python 3.11+

## Installation

```bash
pnpm install
```

## Development commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
```

## Service ports

- Web app: http://localhost:3000
- API: http://localhost:8000
- AI service: http://localhost:8001

## Current implementation phase

This repository is in the initial foundation phase. The goal is to provide a clean, runnable monorepo with the required app structure and minimal health endpoints, without production business features or data integrations.
