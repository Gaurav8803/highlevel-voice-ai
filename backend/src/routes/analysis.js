import { evaluateCall } from '../services/evaluation-service.js'
import { prisma } from '../services/prisma.js'

function isNotFoundError(error) {
  return error?.code === 'NOT_FOUND'
}

export default async function analysisRoutes(fastify) {
  fastify.post('/analysis/evaluate/:callId', async function evaluateCallHandler(request, reply) {
    try {
      return {
        data: await evaluateCall(request.params.callId),
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        return reply.code(404).send({
          error: error.message,
        })
      }

      throw error
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
