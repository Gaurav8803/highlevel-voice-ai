import { prisma } from '../services/prisma.js'
import { generateRubric } from '../services/evaluation-service.js'
import { syncAgents } from '../services/ingestion-service.js'

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

function getLatestEvaluationSummary(evaluations) {
  const [evaluation] = evaluations

  if (!evaluation) {
    return null
  }

  return {
    evaluatedAt: evaluation.evaluatedAt,
    findingsCount: Array.isArray(evaluation.findings) ? evaluation.findings.length : 0,
    id: evaluation.id,
    overallScore: evaluation.overallScore,
  }
}

function serializeAgentListItem(agent) {
  return {
    agentName: agent.agentName,
    businessName: agent.businessName,
    callCount: agent._count.callLogs,
    createdAt: agent.createdAt,
    ghlAgentId: agent.ghlAgentId,
    id: agent.id,
    locationId: agent.locationId,
    rubricGeneratedAt: agent.rubricGeneratedAt,
    updatedAt: agent.updatedAt,
  }
}

function serializeAgentDetail(agent) {
  return {
    actions: agent.actions,
    agentName: agent.agentName,
    agentPrompt: agent.agentPrompt,
    businessName: agent.businessName,
    callCount: agent._count.callLogs,
    createdAt: agent.createdAt,
    ghlAgentId: agent.ghlAgentId,
    id: agent.id,
    latestEvaluationSummary: getLatestEvaluationSummary(agent.evaluations),
    locationId: agent.locationId,
    rawConfig: agent.rawConfig,
    rubric: agent.rubric,
    rubricGeneratedAt: agent.rubricGeneratedAt,
    updatedAt: agent.updatedAt,
  }
}

export default async function agentsRoutes(fastify) {
  fastify.get('/agents', async function listAgentsHandler() {
    const agents = await prisma.agent.findMany({
      include: {
        _count: {
          select: {
            callLogs: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      data: agents.map(serializeAgentListItem),
      meta: {
        page: 1,
        total: agents.length,
      },
    }
  })

  fastify.get('/agents/:id', async function getAgentHandler(request, reply) {
    const agent = await prisma.agent.findUnique({
      where: {
        id: request.params.id,
      },
      include: {
        _count: {
          select: {
            callLogs: true,
          },
        },
        evaluations: {
          orderBy: {
            evaluatedAt: 'desc',
          },
          select: {
            evaluatedAt: true,
            findings: true,
            id: true,
            overallScore: true,
          },
          take: 1,
        },
      },
    })

    if (!agent) {
      return reply.code(404).send({
        error: 'Agent not found.',
      })
    }

    return {
      data: serializeAgentDetail(agent),
    }
  })

  fastify.post('/agents/sync', async function syncAgentsHandler() {
    return {
      data: await syncAgents(),
    }
  })

  fastify.post('/agents/:id/generate-rubric', async function generateRubricHandler(request, reply) {
    try {
      return {
        data: await generateRubric(request.params.id),
      }
    } catch (error) {
      return sendRouteError(reply, error)
    }
  })

  fastify.get('/agents/:id/rubric', async function getRubricHandler(request, reply) {
    const agent = await prisma.agent.findUnique({
      select: {
        id: true,
        rubric: true,
        rubricGeneratedAt: true,
      },
      where: {
        id: request.params.id,
      },
    })

    if (!agent) {
      return reply.code(404).send({
        error: 'Agent not found.',
      })
    }

    return {
      data: {
        id: agent.id,
        rubric: agent.rubric,
        rubricGeneratedAt: agent.rubricGeneratedAt,
      },
    }
  })
}
