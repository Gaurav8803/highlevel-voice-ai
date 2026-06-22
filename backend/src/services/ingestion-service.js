import { ghlClient } from './ghl-client.js'
import { prisma } from './prisma.js'

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
  return {
    actions: agent.actions ?? [],
    agentName: agent.agentName || agent.name || 'Unnamed Agent',
    agentPrompt: agent.agentPrompt || agent.prompt || '',
    businessName: agent.businessName || agent.business?.name || 'Unknown Business',
    ghlAgentId: String(agent.id || agent.agentId),
    locationId: agent.locationId || ghlClient.locationId || '',
    rawConfig: agent,
  }
}

function getCallRecord(callLog, agentId, turns) {
  return {
    agentId,
    calledAt: getDateValue(callLog),
    contactId: String(callLog.contactId || callLog.contact?.id || ''),
    duration: Number(callLog.duration || callLog.callDuration || 0),
    executedActions: callLog.executedActions ?? [],
    extractedData: callLog.extractedData ?? {},
    ghlCallId: String(callLog.id || callLog.callId),
    rawResponse: callLog,
    summary: callLog.summary || '',
    transcript: getTranscriptText(callLog, turns),
    transcriptTurns: turns,
  }
}

function getExistingIdSet(records, key) {
  return new Set(records.map((record) => record[key]))
}

async function syncAgents() {
  const agents = await ghlClient.listAgents()
  const ghlAgentIds = agents.map((agent) => String(agent.id || agent.agentId))
  const existingAgents = await prisma.agent.findMany({
    where: {
      ghlAgentId: {
        in: ghlAgentIds,
      },
    },
    select: {
      ghlAgentId: true,
    },
  })

  const existingIds = getExistingIdSet(existingAgents, 'ghlAgentId')
  let createdCount = 0
  let updatedCount = 0

  for (const agent of agents) {
    const record = getAgentRecord(agent)

    await prisma.agent.upsert({
      create: record,
      update: record,
      where: {
        ghlAgentId: record.ghlAgentId,
      },
    })

    if (existingIds.has(record.ghlAgentId)) {
      updatedCount += 1
      continue
    }

    createdCount += 1
  }

  return {
    createdCount,
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

async function getExistingCallIdSet(callLogs) {
  const ghlCallIds = callLogs.map((callLog) => String(callLog.id || callLog.callId))
  const existingCalls = await prisma.callLog.findMany({
    where: {
      ghlCallId: {
        in: ghlCallIds,
      },
    },
    select: {
      ghlCallId: true,
    },
  })

  return getExistingIdSet(existingCalls, 'ghlCallId')
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
  const existingCallIds = await getExistingCallIdSet(callLogs)
  const agentMap = await getAgentMap(callLogs)
  let ingestedCount = 0
  let skippedCount = 0

  for (const callLog of callLogs) {
    const ghlCallId = String(callLog.id || callLog.callId)

    if (existingCallIds.has(ghlCallId)) {
      skippedCount += 1
      continue
    }

    const agentRecordId = agentMap.get(String(callLog.agentId || ''))

    if (!agentRecordId) {
      skippedCount += 1
      continue
    }

    const turns = normalizeTranscript(callLog.transcriptWithToolCalls)

    await prisma.callLog.create({
      data: getCallRecord(callLog, agentRecordId, turns),
    })

    ingestedCount += 1
  }

  return {
    ingestedCount,
    skippedCount,
    totalFetched: callLogs.length,
  }
}

export { normalizeTranscript, syncAgents, syncCallLogs }
