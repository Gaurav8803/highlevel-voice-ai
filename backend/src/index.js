import process from 'node:process'

import cors from '@fastify/cors'
import fastifyEnv from '@fastify/env'
import Fastify from 'fastify'

import { envOptions, getConfig } from './config.js'

const app = Fastify({
  logger: true,
})

await app.register(fastifyEnv, envOptions)
await app.register(cors, {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true)
      return
    }

    const allowedOrigins = [
      /^https:\/\/app\.gohighlevel\.com$/,
      /^https:\/\/([a-z0-9-]+\.)*gohighlevel\.com$/,
      /^https:\/\/app\.leadconnectorhq\.com$/,
      /^https:\/\/([a-z0-9-]+\.)*leadconnectorhq\.com$/,
      /^https:\/\/([a-z0-9-]+\.)*ngrok-free\.app$/,
      /^https:\/\/([a-z0-9-]+\.)*ngrok-free\.dev$/,
      /^https:\/\/([a-z0-9-]+\.)*ngrok\.app$/,
      /^https:\/\/([a-z0-9-]+\.)*ngrok\.dev$/,
      /^http:\/\/localhost(?::\d+)?$/,
      /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
    ]
    const isAllowed = allowedOrigins.some((pattern) => pattern.test(origin))

    callback(isAllowed ? null : new Error('Origin not allowed by CORS'), isAllowed)
  },
})

const [
  { default: analysisRoutes },
  { default: agentsRoutes },
  { default: callsRoutes },
  { default: dashboardRoutes },
  { default: embedRoutes },
  { default: oauthRoutes },
  { ghlClient },
  { llmService },
  { prisma },
] = await Promise.all([
  import('./routes/analysis.js'),
  import('./routes/agents.js'),
  import('./routes/calls.js'),
  import('./routes/dashboard.js'),
  import('./routes/embed.js'),
  import('./routes/oauth.js'),
  import('./services/ghl-client.js'),
  import('./services/llm-service.js'),
  import('./services/prisma.js'),
])

ghlClient.setLogger(app.log)
llmService.setLogger(app.log)

app.addHook('onClose', async function disconnectPrisma() {
  await prisma.$disconnect()
})

await app.register(async function apiRoutes(api) {
  await api.register(agentsRoutes)
  await api.register(callsRoutes)
  await api.register(analysisRoutes)
  await api.register(dashboardRoutes)
  await api.register(oauthRoutes)
}, { prefix: '/api' })

await app.register(embedRoutes)

app.get('/health', async function healthHandler() {
  return {
    data: {
      status: 'ok',
    },
  }
})

app.get('/api/health', async function apiHealthHandler() {
  return {
    data: {
      status: 'ok',
    },
  }
})

async function startServer() {
  const { PORT } = getConfig(app)

  try {
    await app.listen({
      host: '0.0.0.0',
      port: PORT,
    })
  } catch (error) {
    app.log.error(error, 'Failed to start server')
    process.exit(1)
  }
}

async function shutdown(signal) {
  app.log.info({ signal }, 'Shutting down server')

  try {
    await app.close()
    process.exit(0)
  } catch (error) {
    app.log.error(error, 'Failed to shut down cleanly')
    process.exit(1)
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, function handleSignal() {
    void shutdown(signal)
  })
}

await startServer()
