# GHL Custom Menu Link Integration

This project can be embedded inside a HighLevel sub-account by using a Custom Menu Link that points at the backend's `/embed` route.

## Menu Link URL

Use this format:

```text
https://YOUR_DOMAIN/embed?embedded=true
```

Example:

```text
https://voice-ai.example.com/embed?embedded=true
```

## How To Add The Custom Menu Link

1. Open the target HighLevel sub-account.
2. Go to `Settings`.
3. Open the area for `Custom Menu Links` or the current custom-menu management screen in the sub-account UI.
4. Create a new menu item.
5. Set the display name to something like `Voice AI Copilot`.
6. Paste your deployed embed URL:
   `https://YOUR_DOMAIN/embed?embedded=true`
7. Save the menu link.
8. Refresh the sub-account sidebar if the new item does not appear immediately.
9. Click the new menu entry and confirm the dashboard loads inside the GHL content area.

## Expected Embedded Behavior

- The app loads through `/embed`, which serves the built Vue frontend in iframe-compatible mode.
- Embedded mode keeps the app inside the GHL content panel and uses transparent outer backgrounds.
- The frontend preserves `embedded=true` on internal navigation so agent and call detail pages stay inside the embed flow.

## Health Check

Use this endpoint to verify the backend is alive before connecting it in GHL:

```text
https://YOUR_DOMAIN/api/health
```

Expected response:

```json
{
  "data": {
    "status": "ok"
  }
}
```

## GHL SSO Token Note

The `/embed` route reads an SSO-style token from query parameters if one is present and stores it in session storage for future use.

Currently this project still uses a PIT-backed backend flow for HighLevel API access. The token capture is groundwork for a fuller embedded integration, not a production auth implementation yet.

## Production Note

For a production-grade HighLevel marketplace or multi-tenant deployment, replace PIT-based access with:

- HighLevel OAuth
- A Custom App or marketplace-style installation flow
- Tenant-aware token storage and refresh handling

## Setup Screens

When documenting this for handoff or demo review, capture screenshots of:

1. The GHL sub-account custom menu link configuration form.
2. The saved menu item visible in the left sidebar.
3. The embedded dashboard loaded from `/embed?embedded=true`.
