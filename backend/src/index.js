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
  origin: true,
})

const [
  { default: analysisRoutes },
  { default: agentsRoutes },
  { default: callsRoutes },
  { default: dashboardRoutes },
  { ghlClient },
  { llmService },
  { prisma },
] = await Promise.all([
  import('./routes/analysis.js'),
  import('./routes/agents.js'),
  import('./routes/calls.js'),
  import('./routes/dashboard.js'),
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
}, { prefix: '/api' })

app.get('/health', async function healthHandler() {
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
