import { prisma } from '../services/prisma.js'
import { syncCallLogs } from '../services/ingestion-service.js'

function parsePageValue(value, fallback) {
  const parsedValue = Number.parseInt(value, 10)
  return Number.isNaN(parsedValue) || parsedValue < 1 ? fallback : parsedValue
}

async function resolveSyncAgentId(agentId) {
  if (!agentId) {
    return undefined
  }

  const agent = await prisma.agent.findUnique({
    where: {
      id: agentId,
    },
    select: {
      ghlAgentId: true,
    },
  })

  return agent?.ghlAgentId || agentId
}

function getCallListSelect() {
  return {
    agent: {
      select: {
        agentName: true,
        id: true,
      },
    },
    agentId: true,
    calledAt: true,
    contactId: true,
    createdAt: true,
    duration: true,
    ghlCallId: true,
    id: true,
    summary: true,
  }
}

export default async function callsRoutes(fastify) {
  fastify.get('/calls', async function listCallsHandler(request) {
    const page = parsePageValue(request.query.page, 1)
    const pageSize = parsePageValue(request.query.pageSize, 20)
    const skip = (page - 1) * pageSize
    const where = request.query.agentId ? { agentId: request.query.agentId } : {}

    const [calls, total] = await prisma.$transaction([
      prisma.callLog.findMany({
        orderBy: {
          calledAt: 'desc',
        },
        select: getCallListSelect(),
        skip,
        take: pageSize,
        where,
      }),
      prisma.callLog.count({ where }),
    ])

    return {
      data: calls,
      meta: {
        page,
        total,
      },
    }
  })

  fastify.get('/calls/:id', async function getCallHandler(request, reply) {
    const callLog = await prisma.callLog.findUnique({
      where: {
        id: request.params.id,
      },
      include: {
        agent: {
          select: {
            agentName: true,
            ghlAgentId: true,
            id: true,
          },
        },
      },
    })

    if (!callLog) {
      return reply.code(404).send({
        error: 'Call log not found.',
      })
    }

    return {
      data: callLog,
    }
  })

  fastify.post('/calls/sync', async function syncCallsHandler(request) {
    const agentId = await resolveSyncAgentId(request.body?.agentId)

    return {
      data: await syncCallLogs({ agentId }),
    }
  })
}
