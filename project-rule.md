# Voice AI Observability Copilot — project-rule.md

## Project Overview
An Agent Observability Copilot for HighLevel (GHL) Voice AI agents. Ingests call transcripts, evaluates agent performance against auto-generated rubrics, and surfaces evidence-bound recommendations via a dashboard embedded in GHL.

## Tech Stack
- **Backend:** Node.js 20+, Fastify 5, Prisma ORM, PostgreSQL
- **Frontend:** Vue 3 (Composition API + `<script setup>`), Vite, Tailwind CSS 3
- **AI:** Anthropic Claude API (claude-sonnet-4-6) for rubric generation and semantic evaluation
- **Integration:** GHL REST API (Bearer token auth via PIT or OAuth)
- **Monorepo:** `/backend` and `/frontend` at project root

## Architecture — Evaluation Pipeline
1. Agent config ingestion → LLM generates evaluation rubric → cached in DB
2. Call transcript ingestion → normalize turns → deterministic checks (no LLM)
3. Semantic evaluation via LLM (rubric + transcript + deterministic results → findings + recommendations)
4. Evidence policy: reject any claim without transcript span reference
5. Results served via REST API → Vue dashboard

## Code Style — CRITICAL (submission under manual review)
- **No slop:** Every line must be intentional. No boilerplate filler, no dead code, no commented-out blocks.
- **Naming:** camelCase for variables/functions, PascalCase for classes/components, SCREAMING_SNAKE for constants.
- **Functions:** Small, single-purpose. Max ~40 lines. Extract helpers.
- **Comments:** Only for "why", never for "what". No `// loop through array` type comments.
- **Error handling:** Always handle errors explicitly. No empty catch blocks. Use Fastify error patterns.
- **No `any` types** if using TypeScript hints in JSDoc.
- **Imports:** Group by: node builtins → external packages → internal modules. Blank line between groups.
- **No console.log in production code.** Use Fastify's built-in logger (`request.log`, `fastify.log`).

## Backend Conventions
- Route files in `/backend/src/routes/` — one file per resource (agents.js, calls.js, analysis.js, dashboard.js).
- Business logic in `/backend/src/services/` — evaluation logic, GHL client, LLM service.
- Prisma schema in `/backend/prisma/schema.prisma`.
- Config via environment variables, loaded in `/backend/src/config.js`.
- All GHL API calls go through `/backend/src/services/ghl-client.js` — single source of truth for auth headers, base URL, error handling.
- API responses follow shape: `{ data: ..., meta?: { page, total } }` for lists, `{ data: ... }` for singles.
- Use async/await everywhere, no callbacks.

## Frontend Conventions
- Components in `/frontend/src/components/` — organized by feature (dashboard/, agents/, calls/).
- Pages in `/frontend/src/views/`.
- Composables in `/frontend/src/composables/` — `useAgents.js`, `useCalls.js`, `useAnalysis.js`.
- API client in `/frontend/src/api/` — thin wrapper around fetch, mirrors backend route structure.
- Tailwind for all styling. No scoped CSS unless truly necessary.
- No Pinia/Vuex unless state complexity demands it — prefer composables with reactive refs.

## LLM Integration Rules
- All LLM calls go through `/backend/src/services/llm-service.js`.
- System prompts are stored as template literals in `/backend/src/prompts/` — one file per prompt type.
- Always request structured JSON output. Parse and validate before storing.
- Set reasonable `max_tokens` per call type (rubric: 2000, evaluation: 3000).
- Log LLM call duration and token usage for observability.
- Never expose raw LLM output to frontend — always validate and transform first.

## Evidence Policy
- Every finding must reference transcript turn indices and/or timestamps.
- Deterministic findings have `confidence: 1.0` and `source: "deterministic"`.
- LLM findings have `confidence: 0.0-1.0` and `source: "llm_semantic"`.
- If LLM returns a claim without evidence spans, discard it. Log the rejection.
- The frontend visually distinguishes deterministic vs. semantic findings.

## GHL Integration
- API base: `https://services.leadconnectorhq.com`
- Auth: Bearer token (PIT for dev, OAuth access token for production)
- Always pass `locationId` as query param and `Version: 2021-07-28` header.
- Key endpoints:
  - `GET /voice-ai/agents?locationId={id}` — list agents
  - `GET /voice-ai/agents/{agentId}?locationId={id}` — agent detail
  - `GET /voice-ai/dashboard/call-logs?locationId={id}` — list call logs with transcripts
  - `GET /voice-ai/dashboard/call-logs/{callId}?locationId={id}` — single call log

## Testing
- Backend: Vitest for unit tests on evaluation logic and deterministic checks.
- Test the evaluator with known transcripts — the Maya call transcript is the baseline.
- Mock GHL API responses in tests using the real response shapes we captured.

## What NOT To Do
- Don't over-engineer. This is a focused submission, not a production SaaS.
- Don't add auth/login to our app — it runs inside GHL which handles auth.
- Don't use TypeScript — the assignment says Node.js, keep it simple JS with good JSDoc.
- Don't add WebSocket/real-time unless basic polling is insufficient for demo.
- Don't create unused utilities or "helper" files. Every file must be used.
