# HighLevel Sandbox Setup Guide

This guide walks through how to install and run the Voice AI Observability Copilot inside a HighLevel sandbox sub-account.

## Goal

At the end of this setup, you will be able to:

- run the backend locally
- serve the embedded dashboard through the backend
- expose it with ngrok
- add it to a HighLevel sandbox sub-account as a Custom Menu Link
- sync agents and call logs from HighLevel into the observability dashboard

## Prerequisites

You need:

- Node.js 20+
- PostgreSQL running locally
- a HighLevel sandbox sub-account
- an Anthropic API key
- a HighLevel Personal Access Token for the sandbox location, or marketplace OAuth credentials for install-flow testing
- ngrok installed locally

## 1. Clone The Repo

```bash
git clone <YOUR_REPO_URL>
cd highlevel-voice-ai
```

## 2. Create Environment Variables

Create a root `.env` file based on `.env.example`.

Required values:

```env
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/highlevel_voice_ai
GHL_API_BASE=https://services.leadconnectorhq.com
GHL_PIT_TOKEN=YOUR_HIGHLEVEL_PIT
GHL_LOCATION_ID=YOUR_SUBACCOUNT_LOCATION_ID
GHL_API_VERSION=2021-07-28
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
```

Optional marketplace-install values:

```env
GHL_CLIENT_ID=YOUR_MARKETPLACE_CLIENT_ID
GHL_CLIENT_SECRET=YOUR_MARKETPLACE_CLIENT_SECRET
GHL_REDIRECT_URI=https://YOUR_DOMAIN/api/oauth/callback
```

## 3. Install Dependencies

Backend:

```bash
cd backend
npm install
```

Frontend:

```bash
cd ../frontend
npm install
```

## 4. Generate Prisma Client

```bash
cd ../backend
npm run prisma:generate
```

If the database schema is not initialized yet, run your Prisma migration flow before starting the app.

## 5. Start The Backend

```bash
cd backend
npm start
```

The backend provides:

- REST API endpoints under `/api`
- the embedded app route under `/embed`
- the install callback route under `/api/oauth/callback`

Verify the health endpoint:

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "data": {
    "status": "ok"
  }
}
```

## 6. Build The Frontend For Embedded Use

The backend serves the built frontend from `/embed`, so build the frontend whenever you want the latest UI available inside HighLevel.

```bash
cd ../frontend
npm run build
```

For local UI-only iteration, you can also run the frontend separately:

```bash
VITE_API_BASE=http://localhost:3000/api npm run dev
```

That local Vite URL is useful for development, but HighLevel embedding should use the backend-served `/embed` route.

## 7. Confirm Local Embedded Mode

Open:

```text
http://localhost:3000/embed?embedded=true
```

You should see the dashboard render in embedded mode without the outer standalone shell behavior.

## 8. Expose The Backend With ngrok

Run ngrok against the backend port, not the Vite port:

```bash
ngrok http 3000
```

Example output:

```text
Forwarding https://your-subdomain.ngrok-free.dev -> http://localhost:3000
```

Your public embed URL becomes:

```text
https://your-subdomain.ngrok-free.dev/embed?embedded=true
```

Your public API health URL becomes:

```text
https://your-subdomain.ngrok-free.dev/api/health
```

## 9. Add The App To The HighLevel Sandbox

Inside the target HighLevel sandbox sub-account:

1. Open `Settings`.
2. Go to the area for `Custom Menu Links`.
3. Create a new menu link.
4. Set the label to `Voice AI Copilot`.
5. Paste the ngrok embed URL:

```text
https://your-subdomain.ngrok-free.dev/embed?embedded=true
```

6. Save the menu item.
7. Refresh the HighLevel sidebar if needed.
8. Open the new menu link and confirm the dashboard loads in the content area.

## 10. Sync Sandbox Data

Once the dashboard opens inside HighLevel:

1. Click `Sync data` to ingest agents and calls from the sandbox location.
2. Click `Sync & analyze` to:
   - sync agents
   - sync call logs
   - generate missing rubrics
   - evaluate unevaluated calls
   - refresh agent-level analysis

After this completes, you should be able to inspect:

- fleet overview
- agent-specific rubric
- per-call evaluations
- aggregated agent recommendations

## 11. Optional OAuth Install Callback Testing

If you are testing marketplace-style installation flow instead of PIT-only local mode:

- set `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, and `GHL_REDIRECT_URI`
- point the marketplace callback to:

```text
https://your-subdomain.ngrok-free.dev/api/oauth/callback
```

Notes:

- the current demo returns a clean install-success page even if token exchange fails, so the HighLevel install flow does not break visually
- PIT-backed API access is still the main demo path for transcript sync and analysis

## Troubleshooting

### The embed page is blank

Check:

- backend is running
- `frontend/dist` exists from a recent `npm run build`
- ngrok points to the backend port, not the Vite port
- the HighLevel menu link uses `/embed?embedded=true`

### The dashboard loads but API calls fail

Check:

- `GHL_PIT_TOKEN` is valid
- `GHL_LOCATION_ID` matches the sandbox sub-account
- the backend health endpoint works
- PostgreSQL is running and reachable through `DATABASE_URL`

### I only see older frontend UI

Rebuild the frontend:

```bash
cd frontend
npm run build
```

Then refresh the embedded page.

### Sync works but no data appears

Check the sandbox itself:

- the sub-account actually has Voice AI agents
- there are call logs available for that location
- your token has access to the same location id

## Submission-Friendly Demo Flow

Once setup is complete, the cleanest demo order is:

1. Open one agent
2. Show the synced agent context
3. Show the generated rubric
4. Open one evaluated call
5. Show transcript-backed findings and recommendations
6. Return to the agent page and show aggregated insights across call history
