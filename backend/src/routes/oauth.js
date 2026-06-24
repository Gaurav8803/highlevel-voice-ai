const ALLOWED_FRAME_ANCESTORS = [
  "'self'",
  'https://app.gohighlevel.com',
  'https://*.gohighlevel.com',
  'https://app.leadconnectorhq.com',
  'https://*.leadconnectorhq.com',
]

function buildCallbackHeaders(reply) {
  reply.header('Content-Security-Policy', [
    "default-src 'self' 'unsafe-inline'",
    `frame-ancestors ${ALLOWED_FRAME_ANCESTORS.join(' ')}`,
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
  ].join('; '))
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  reply.header('X-Frame-Options', 'ALLOWALL')
}

function renderInstallResultPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Voice AI Copilot Installed</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        color-scheme: light;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at top, rgba(59, 130, 246, 0.10), transparent 38%),
          linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
        color: #0f172a;
        font-family: Inter, system-ui, sans-serif;
      }

      .card {
        width: min(100%, 720px);
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.20);
        border-radius: 24px;
        box-shadow: 0 20px 48px rgba(15, 23, 42, 0.10);
        padding: 32px;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: #e0f2fe;
        color: #075985;
        font-size: 13px;
        font-weight: 600;
      }

      h1 {
        margin: 18px 0 12px;
        font-size: clamp(28px, 5vw, 40px);
        line-height: 1.05;
      }

      p {
        margin: 0;
        color: #475569;
        font-size: 16px;
        line-height: 1.7;
      }

      .callout {
        margin-top: 22px;
        padding: 16px 18px;
        border-radius: 16px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #334155;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="badge">Voice AI Copilot</div>
      <h1>Installed successfully</h1>
      <p>Voice AI Copilot installed successfully. Open it from your sub-account's left sidebar.</p>
      <div class="callout">
        If the menu item does not appear immediately, refresh the sub-account once and open the app again from the left sidebar.
      </div>
    </main>
  </body>
</html>`
}

function getErrorMessage(error) {
  if (!error) {
    return 'Unknown OAuth callback error'
  }

  if (typeof error.message === 'string' && error.message) {
    return error.message
  }

  return String(error)
}

async function exchangeCodeForToken(config, code) {
  const response = await fetch('https://services.leadconnectorhq.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      client_id: config.GHL_CLIENT_ID || '',
      client_secret: config.GHL_CLIENT_SECRET || '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.GHL_REDIRECT_URI || '',
      user_type: 'Location',
    }),
  })

  const rawBody = await response.text()
  let payload = null

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody)
    } catch {
      payload = rawBody
    }
  }

  if (!response.ok) {
    const error = new Error(`OAuth token exchange failed with status ${response.status}`)
    error.statusCode = response.status
    error.payload = payload
    throw error
  }

  return payload
}

export default async function oauthRoutes(fastify) {
  fastify.get('/oauth/callback', async function oauthCallbackHandler(request, reply) {
    buildCallbackHeaders(reply)

    const { code = null, locationId = null } = request.query || {}
    const config = request.server.config

    try {
      if (!code || !locationId) {
        fastify.log.warn(
          { codePresent: Boolean(code), locationId },
          'GHL OAuth callback missing required query params'
        )
      } else if (!config.GHL_CLIENT_ID || !config.GHL_CLIENT_SECRET || !config.GHL_REDIRECT_URI) {
        fastify.log.warn(
          { locationId },
          'GHL OAuth callback received install request but OAuth client settings are missing'
        )
      } else {
        const tokenPayload = await exchangeCodeForToken(config, code)
        fastify.log.info(
          {
            accessTokenPreview: typeof tokenPayload?.access_token === 'string'
              ? `${tokenPayload.access_token.slice(0, 8)}...`
              : null,
            expiresIn: tokenPayload?.expires_in ?? null,
            locationId,
            refreshTokenPreview: typeof tokenPayload?.refresh_token === 'string'
              ? `${tokenPayload.refresh_token.slice(0, 8)}...`
              : null,
            scope: tokenPayload?.scope ?? null,
          },
          'GHL OAuth install token received'
        )
      }
    } catch (error) {
      fastify.log.error(
        {
          error: getErrorMessage(error),
          locationId,
          payload: error?.payload ?? null,
          statusCode: error?.statusCode ?? null,
        },
        'GHL OAuth callback token exchange failed'
      )
    }

    return reply
      .code(200)
      .type('text/html; charset=utf-8')
      .send(renderInstallResultPage())
  })
}
