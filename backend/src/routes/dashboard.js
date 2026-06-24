import {
  getAgentDashboard,
  getCallDashboard,
  getDashboardOverview,
  syncAndEvaluateDashboard,
} from '../services/dashboard-service.js'
import { generateAgentAnalysis } from '../services/evaluation-service.js'

function sendRouteError(reply, error) {
  if (error?.code === 'NOT_FOUND') {
    return reply.code(404).send({
      error: error.message,
    })
  }

  if (error?.code === 'INVALID_LLM_JSON' || error?.code === 'LLM_REQUEST_FAILED') {
    return reply.code(502).send({
      error: error.message,
    })
  }

  throw error
}

export default async function dashboardRoutes(fastify) {
  fastify.get('/dashboard/overview', async function getOverviewHandler() {
    return {
      data: await getDashboardOverview(),
    }
  })

  fastify.get('/dashboard/agent/:agentId', async function getAgentDashboardHandler(request, reply) {
    try {
      return {
        data: await getAgentDashboard(request.params.agentId),
      }
    } catch (error) {
      return sendRouteError(reply, error)
    }
  })

  fastify.post('/dashboard/agent/:agentId/analyze', async function analyzeAgentHandler(request, reply) {
    try {
      return {
        data: await generateAgentAnalysis(request.params.agentId, { forceRegenerate: true }),
      }
    } catch (error) {
      return sendRouteError(reply, error)
    }
  })

  fastify.get('/dashboard/call/:callId', async function getCallDashboardHandler(request, reply) {
    try {
      return {
        data: await getCallDashboard(request.params.callId),
      }
    } catch (error) {
      return sendRouteError(reply, error)
    }
  })

  fastify.post('/dashboard/sync-and-evaluate', async function syncAndEvaluateHandler(request, reply) {
    try {
      return {
        data: await syncAndEvaluateDashboard(),
      }
    } catch (error) {
      return sendRouteError(reply, error)
    }
  })
}
