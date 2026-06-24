# Voice AI Observability Copilot

An observability layer for HighLevel Voice AI agents that turns synced call logs into agent-specific rubrics, per-call evaluations, and aggregated recommendations for prompt, script, and workflow improvement.

## What It Does

The product closes the loop from:

1. Agent configuration
2. Rubric generation
3. Per-call transcript evaluation
4. Aggregated agent insight across call history

Instead of manually reviewing transcripts, the dashboard highlights where an agent is missing goals, breaking flow, or creating workflow issues, and it ties every finding back to transcript evidence.

## Architecture

### Monorepo Structure

- `backend/` — Fastify 5 API, Prisma, PostgreSQL
- `frontend/` — Vue 3 + Vite dashboard, designed to run standalone or embedded inside HighLevel
- `docs/` — integration notes and sample generated outputs

### Backend

The backend is responsible for:

- syncing agents and call logs from HighLevel
- normalizing transcript turns
- caching agent rubrics in Postgres
- running call-level LLM evaluations
- generating agent-level aggregated insight from stored evaluation output
- serving dashboard and embed routes

Core pieces:

- `backend/src/services/ghl-client.js` — single HighLevel API wrapper
- `backend/src/services/ingestion-service.js` — syncs agents and call logs into Postgres
- `backend/src/services/evaluation-service.js` — rubric generation, per-call evaluation, agent-level analysis
- `backend/src/services/dashboard-service.js` — dashboard aggregation queries and response shaping
- `backend/src/prompts/` — rubric, call evaluation, and agent analysis prompts
- `backend/prisma/schema.prisma` — persistence layer for agents, calls, and evaluations

### Frontend

The frontend is a Vue dashboard that surfaces:

- fleet overview across agents
- per-agent rubric and recurring issues
- per-call transcript-backed evaluations
- actionable recommendations with prompt patches and workflow adjustments

Core pieces:

- `frontend/src/views/DashboardView.vue` — overall dashboard
- `frontend/src/views/AgentDetailView.vue` — agent-specific view
- `frontend/src/views/CallDetailView.vue` — transcript + finding detail
- `frontend/src/api/client.js` — frontend API wrapper
- `frontend/src/composables/` — data loading and mutations

### Evaluation Pipeline

1. Sync the current agent config from HighLevel.
2. Generate an agent-specific rubric from the agent prompt, actions, and business context.
3. Sync call logs and normalize the transcript into turn-level structure.
4. Evaluate each call against the rubric with evidence-bound LLM output.
5. Aggregate repeated call-level findings into agent-wide recommendations.
6. Render the output in a dashboard or embedded HighLevel view.

### Data Model

Main entities:

- `Agent` — synced HighLevel Voice AI config, rubric, and cached agent analysis
- `CallLog` — normalized transcript, actions, extracted data, and raw call response
- `CallEvaluation` — stored semantic evaluation, findings, recommendations, score, and call path

### Product

- Defined the core loop around observability, not just transcript display
- Framed the experience around four states: config, rubric, per-call evaluation, aggregated insight
- Prioritized business-facing recommendations over raw technical metrics

### Design

- Shaped the dashboard to feel native inside HighLevel’s interface
- Designed the information hierarchy around what needs attention first
- Made evidence, recommendations, and rubric criteria easy to inspect without overwhelming the user

### Engineering

- Implemented the Fastify + Prisma backend and Vue frontend
- Built HighLevel ingestion, LLM orchestration, caching, evaluation persistence, and embedded delivery
- Added config-hash-based rubric invalidation so LLM calls are not wasted on unchanged agent configs

### QA

- Added evaluator unit tests with real-shape transcript fixtures
- Tested with live HighLevel-linked data in a sandbox flow
- Verified the experience in local, embedded, and ngrok-based preview modes

## What Is Functional Today

These parts are implemented and working in the current demo stack:

- HighLevel agent sync via REST API
- HighLevel call log sync via REST API
- Transcript normalization and Postgres persistence
- Agent-specific rubric generation with Anthropic
- Per-call semantic evaluation with evidence requirements
- Agent-level aggregated analysis from stored call-level findings
- Dashboard overview, agent detail, and call detail flows
- HighLevel embed route via `/embed?embedded=true`
- Custom menu-link setup flow documentation
- Minimal OAuth callback endpoint for marketplace install flow

## Local Setup

### Prerequisites

- Node.js 20+
- PostgreSQL
- `.env` at repo root with:
  - `DATABASE_URL`
  - `GHL_PIT_TOKEN`
  - `GHL_LOCATION_ID`
  - `ANTHROPIC_API_KEY`
  - optional marketplace/install values:
    - `GHL_CLIENT_ID`
    - `GHL_CLIENT_SECRET`
    - `GHL_REDIRECT_URI`

### Install

```bash
cd backend && npm install
cd ../frontend && npm install
```

### Generate Prisma Client

```bash
cd backend
npm run prisma:generate
```

### Run Locally

Backend:

```bash
cd backend
npm start
```

Frontend:

```bash
cd frontend
npm run dev
```
