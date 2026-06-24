import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const FRONTEND_DIST_DIR = fileURLToPath(new URL('../../../frontend/dist', import.meta.url))
const INDEX_FILE_PATH = path.join(FRONTEND_DIST_DIR, 'index.html')
const ALLOWED_EMBED_ANCESTORS = [
  "'self'",
  'https://app.gohighlevel.com',
  'https://*.gohighlevel.com',
  'https://app.leadconnectorhq.com',
  'https://*.leadconnectorhq.com',
]
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

function getContentType(filePath) {
  return MIME_TYPES[path.extname(filePath)] || 'application/octet-stream'
}

function getSsoToken(query) {
  return query.ssoToken || query.token || query.ghlSsoToken || null
}

function buildEmbedHeaders(reply) {
  reply.header('Content-Security-Policy', [
    "default-src 'self'",
    "connect-src 'self' https://app.gohighlevel.com https://*.gohighlevel.com https://app.leadconnectorhq.com https://*.leadconnectorhq.com",
    `frame-ancestors ${ALLOWED_EMBED_ANCESTORS.join(' ')}`,
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  ].join('; '))
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  reply.header('X-Frame-Options', 'ALLOWALL')
}

async function hasBuiltFrontend() {
  try {
    await access(INDEX_FILE_PATH)
    return true
  } catch {
    return false
  }
}

function injectEmbedBootstrap(indexHtml, ssoToken) {
  const bootstrap = `
    <script>
      window.__VOICE_AI_EMBED__ = {
        embedded: true,
        ghlSsoToken: ${JSON.stringify(ssoToken)},
        routerBase: '/embed/'
      };
      if (window.__VOICE_AI_EMBED__.ghlSsoToken) {
        window.sessionStorage.setItem(
          'voice-ai-copilot:ghl-sso-token',
          window.__VOICE_AI_EMBED__.ghlSsoToken
        );
      }
    </script>
  `

  return indexHtml
    .replaceAll('href="/assets/', 'href="/embed/assets/')
    .replaceAll('src="/assets/', 'src="/embed/assets/')
    .replace('href="/favicon.svg"', 'href="/embed/favicon.svg"')
    .replace('</head>', `${bootstrap}\n  </head>`)
}

async function serveEmbedApp(reply, query) {
  buildEmbedHeaders(reply)

  if (!await hasBuiltFrontend()) {
    return reply
      .code(503)
      .type('text/html; charset=utf-8')
      .send(`
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Voice AI Copilot</title>
          </head>
          <body style="font-family: Inter, sans-serif; background: #f5f6fa; color: #1e293b; padding: 32px;">
            <h1 style="margin: 0 0 12px;">Frontend build not found</h1>
            <p style="margin: 0; max-width: 640px; line-height: 1.6;">
              Run <code>npm run build</code> in the <code>frontend</code> directory before using the
              GHL embedded menu-link route.
            </p>
          </body>
        </html>
      `)
  }

  const indexHtml = await readFile(INDEX_FILE_PATH, 'utf8')
  const html = injectEmbedBootstrap(indexHtml, getSsoToken(query))

  return reply.type('text/html; charset=utf-8').send(html)
}

function resolveDistAssetPath(relativePath) {
  const normalizedPath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '')
  return path.join(FRONTEND_DIST_DIR, normalizedPath)
}

function normalizeEmbedAssetPath(relativePath) {
  return String(relativePath || '').replace(/^assets[\\/]+/, '')
}

async function serveDistAsset(reply, relativePath) {
  buildEmbedHeaders(reply)

  try {
    const assetPath = resolveDistAssetPath(relativePath)
    const fileBuffer = await readFile(assetPath)
    return reply.type(getContentType(assetPath)).send(fileBuffer)
  } catch (error) {
    reply.code(404)
    return {
      error: 'Embedded asset not found.',
    }
  }
}

export default async function embedRoutes(fastify) {
  fastify.get('/embed/assets/*', async function embedAssetHandler(request, reply) {
    return serveDistAsset(reply, path.join('assets', normalizeEmbedAssetPath(request.params['*'])))
  })

  fastify.get('/embed/favicon.svg', async function embedFaviconHandler(_request, reply) {
    return serveDistAsset(reply, 'favicon.svg')
  })

  fastify.get('/embed', async function embedEntryHandler(request, reply) {
    return serveEmbedApp(reply, request.query)
  })

  fastify.get('/embed/*', async function embedSpaHandler(request, reply) {
    return serveEmbedApp(reply, request.query)
  })
}
