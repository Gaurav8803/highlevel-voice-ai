import { evaluateAllCalls, evaluateCall } from '../services/evaluation-service.js'
import { prisma } from '../services/prisma.js'

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

export default async function analysisRoutes(fastify) {
  fastify.post('/analysis/evaluate/:callId', async function evaluateCallHandler(request, reply) {
    try {
      return {
        data: await evaluateCall(request.params.callId),
      }
    } catch (error) {
      return sendRouteError(reply, error)
    }
  })

  fastify.post('/analysis/evaluate-all/:agentId', async function evaluateAllCallsHandler(request, reply) {
    try {
      return {
        data: await evaluateAllCalls(request.params.agentId),
      }
    } catch (error) {
      return sendRouteError(reply, error)
    }
  })

  fastify.get('/analysis/evaluation/:callId', async function getEvaluationHandler(request, reply) {
    const evaluation = await prisma.callEvaluation.findUnique({
      where: {
        callLogId: request.params.callId,
      },
    })

    if (!evaluation) {
      return reply.code(404).send({
        error: 'Evaluation not found.',
      })
    }

    return {
      data: evaluation,
    }
  })
}
