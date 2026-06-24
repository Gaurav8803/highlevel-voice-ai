import { ghlClient } from './ghl-client.js'
import { prisma } from './prisma.js'
import { computeAgentConfigHash } from '../utils/hashing.js'

function normalizeRole(value, turn) {
  const role = String(value || '').toLowerCase()

  if (role === 'action_executed' || role === 'action' || role === 'tool') {
    return 'action'
  }

  if (role === 'assistant' || role === 'agent' || role === 'bot') {
    return 'agent'
  }

  if (role === 'user' || role === 'human' || role === 'contact' || role === 'customer') {
    return 'user'
  }

  return turn.toolName || turn.toolType ? 'action' : 'user'
}

function getTurnContent(turn) {
  return (
    turn.content ||
    turn.message ||
    turn.text ||
    turn.transcript ||
    turn.response ||
    turn.toolResult ||
    ''
  )
}

function parseToolArguments(value) {
  if (typeof value !== 'string') {
    return value ?? null
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function getTranscriptText(callLog, turns) {
  if (typeof callLog.transcript === 'string' && callLog.transcript.length > 0) {
    return callLog.transcript
  }

  return turns
    .map((turn) => `${turn.role}: ${turn.content}`.trim())
    .filter(Boolean)
    .join('\n')
}

function getDateValue(callLog) {
  const value =
    callLog.calledAt ||
    callLog.startTime ||
    callLog.startedAt ||
    callLog.createdAt ||
    callLog.dateAdded

  if (!value) {
    return new Date()
  }

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate
}

function getAgentRecord(agent) {
  const welcomeMessage = agent.welcomeMessage || agent.prompts?.welcomeMessage || ''

  return {
    actions: agent.actions ?? [],
    agentName: agent.agentName || agent.name || 'Unnamed Agent',
    agentPrompt: agent.agentPrompt || agent.prompt || '',
    businessName: agent.businessName || agent.business?.name || 'Unknown Business',
    configHash: computeAgentConfigHash({
      actions: agent.actions ?? [],
      agentPrompt: agent.agentPrompt || agent.prompt || '',
      welcomeMessage,
    }),
    ghlAgentId: String(agent.id || agent.agentId),
    locationId: agent.locationId || ghlClient.locationId || '',
    rawConfig: agent,
    welcomeMessage,
  }
}

function getCallRecord(callLog, agentId, turns) {
  return {
    agentId,
    calledAt: getDateValue(callLog),
    contactId: String(callLog.contactId || callLog.contact?.id || ''),
    duration: Number(callLog.duration || callLog.callDuration || 0),
    executedActions: callLog.executedActions ?? callLog.executedCallActions ?? [],
    extractedData: callLog.extractedData ?? {},
    ghlCallId: String(callLog.id || callLog.callId),
    rawResponse: callLog,
    summary: callLog.summary || '',
    transcript: getTranscriptText(callLog, turns),
    transcriptTurns: turns,
  }
}

function getLocationIdScope() {
  return ghlClient.locationId || null
}

function getAgentSyncScopeWhere() {
  const locationId = getLocationIdScope()

  return locationId
    ? {
      locationId,
    }
    : {}
}

async function deleteStaleAgents(activeAgentIds) {
  const scopeWhere = getAgentSyncScopeWhere()
  const staleAgents = await prisma.agent.findMany({
    select: {
      id: true,
    },
    where: {
      ...scopeWhere,
      ghlAgentId: {
        notIn: activeAgentIds,
      },
    },
  })

  if (staleAgents.length === 0) {
    return 0
  }

  const { count } = await prisma.agent.deleteMany({
    where: {
      id: {
        in: staleAgents.map((agent) => agent.id),
      },
    },
  })

  return count
}

async function syncAgents() {
  const agents = await ghlClient.listAgents()
  const ghlAgentIds = agents.map((agent) => String(agent.id || agent.agentId))
  const existingAgents = await prisma.agent.findMany({
    where: getAgentSyncScopeWhere(),
    select: {
      agentName: true,
      businessName: true,
      configHash: true,
      id: true,
      ghlAgentId: true,
      locationId: true,
    },
  })

  const existingAgentsByGhlId = new Map(
    existingAgents.map((agent) => [agent.ghlAgentId, agent])
  )
  let createdCount = 0
  const activeAgentIds = new Set()
  let updatedCount = 0

  for (const agent of agents) {
    const record = getAgentRecord(agent)
    const existingAgent = existingAgentsByGhlId.get(record.ghlAgentId)
    activeAgentIds.add(record.ghlAgentId)

    if (!existingAgent) {
      await prisma.agent.create({
        data: record,
      })

      createdCount += 1
      continue
    }

    const updateData = {}

    if (existingAgent.agentName !== record.agentName) {
      updateData.agentName = record.agentName
    }

    if (existingAgent.businessName !== record.businessName) {
      updateData.businessName = record.businessName
    }

    if (existingAgent.locationId !== record.locationId) {
      updateData.locationId = record.locationId
    }

    if (existingAgent.configHash !== record.configHash) {
      updateData.actions = record.actions
      updateData.agentPrompt = record.agentPrompt
      updateData.configHash = record.configHash
      updateData.rawConfig = record.rawConfig
      updateData.welcomeMessage = record.welcomeMessage
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.agent.update({
        data: updateData,
        where: {
          ghlAgentId: record.ghlAgentId,
        },
      })

      updatedCount += 1
    }
  }

  const deletedCount = await deleteStaleAgents([...activeAgentIds])

  return {
    createdCount,
    deletedCount,
    totalSynced: agents.length,
    updatedCount,
  }
}

async function getAgentMap(callLogs) {
  const ghlAgentIds = [...new Set(callLogs.map((callLog) => String(callLog.agentId || '')))].filter(Boolean)
  const agents = await prisma.agent.findMany({
    where: {
      ghlAgentId: {
        in: ghlAgentIds,
      },
    },
    select: {
      ghlAgentId: true,
      id: true,
    },
  })

  return new Map(agents.map((agent) => [agent.ghlAgentId, agent.id]))
}

async function getExistingCallsForSync(agentId) {
  if (agentId) {
    const agent = await prisma.agent.findUnique({
      where: {
        ghlAgentId: agentId,
      },
      select: {
        id: true,
      },
    })

    if (!agent) {
      return []
    }

    return prisma.callLog.findMany({
      where: {
        agentId: agent.id,
      },
      select: {
        ghlCallId: true,
        id: true,
      },
    })
  }

  return prisma.callLog.findMany({
    where: {
      agent: getAgentSyncScopeWhere(),
    },
    select: {
      ghlCallId: true,
      id: true,
    },
  })
}

async function deleteStaleCalls(existingCalls, activeCallIds) {
  const staleCallIds = existingCalls
    .filter((callLog) => !activeCallIds.has(callLog.ghlCallId))
    .map((callLog) => callLog.id)

  if (staleCallIds.length === 0) {
    return 0
  }

  const { count } = await prisma.callLog.deleteMany({
    where: {
      id: {
        in: staleCallIds,
      },
    },
  })

  return count
}

function normalizeTranscript(transcriptWithToolCalls) {
  const turns = Array.isArray(transcriptWithToolCalls) ? transcriptWithToolCalls : []

  return turns.map((turn, index) => ({
    content: getTurnContent(turn),
    endTime: turn.endTime ?? null,
    index,
    role: normalizeRole(turn.role || turn.speaker || turn.type, turn),
    startTime: turn.startTime ?? null,
    toolArguments: parseToolArguments(turn.toolArguments),
    toolName: turn.toolName ?? null,
    toolType: turn.toolType ?? null,
  }))
}

async function syncCallLogs({ agentId } = {}) {
  const callLogs = await ghlClient.listCallLogs({ agentId })
  const agentMap = await getAgentMap(callLogs)
  const existingCalls = await getExistingCallsForSync(agentId)
  const existingCallsByGhlId = new Map(
    existingCalls.map((callLog) => [callLog.ghlCallId, callLog])
  )
  const activeCallIds = new Set()
  let ingestedCount = 0
  let skippedCount = 0
  let updatedCount = 0

  for (const callLog of callLogs) {
    const ghlCallId = String(callLog.id || callLog.callId)
    activeCallIds.add(ghlCallId)

    const agentRecordId = agentMap.get(String(callLog.agentId || ''))

    if (!agentRecordId) {
      skippedCount += 1
      continue
    }

    const turns = normalizeTranscript(callLog.transcriptWithToolCalls)
    const record = getCallRecord(callLog, agentRecordId, turns)
    const existingCall = existingCallsByGhlId.get(ghlCallId)

    if (existingCall) {
      await prisma.callLog.update({
        data: record,
        where: {
          id: existingCall.id,
        },
      })

      updatedCount += 1
      continue
    }

    await prisma.callLog.create({
      data: record,
    })

    ingestedCount += 1
  }

  const deletedCount = await deleteStaleCalls(existingCalls, activeCallIds)

  return {
    deletedCount,
    ingestedCount,
    skippedCount,
    totalFetched: callLogs.length,
    updatedCount,
  }
}

export { normalizeTranscript, syncAgents, syncCallLogs }
