const FAREWELL_PATTERNS = ['goodbye', 'bye', 'have a great day', 'thank you', 'thanks', 'talk soon']
const GREETING_THRESHOLD = 0.6
const MAX_ALLOWED_GAP_SECONDS = 10
const MAX_ALLOWED_RESPONSE_SECONDS = 5
const MAX_CONSECUTIVE_AGENT_TURNS = 5

function roundMetric(value) {
  return Number(value.toFixed(2))
}

function createCheck({ checkId, category, label, passed, evidence, recommendation }) {
  return {
    category,
    checkId,
    confidence: 1,
    evidence,
    label,
    passed,
    recommendation,
    source: 'deterministic',
  }
}

function normalizeWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function slugify(value) {
  return String(value || 'check')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getConfiguredActions(agent) {
  if (Array.isArray(agent.actions)) {
    return agent.actions
  }

  return Array.isArray(agent.rawConfig?.actions) ? agent.rawConfig.actions : []
}

function getWelcomeMessage(agent) {
  return agent.welcomeMessage || agent.rawConfig?.welcomeMessage || ''
}

function getMaxCallDuration(agent) {
  const rawValue = agent.maxCallDuration ?? agent.rawConfig?.maxCallDuration
  const parsedValue = Number(rawValue)

  return Number.isFinite(parsedValue) ? parsedValue : null
}

function getFirstAgentTurn(turns) {
  return turns.find((turn) => turn.role === 'agent')
}

function getLastAgentTurn(turns) {
  return [...turns].reverse().find((turn) => turn.role === 'agent')
}

function buildTurnEvidence(turn, expected, actual) {
  const evidence = {
    actual,
    expected,
    turnIndices: turn ? [turn.index] : [],
  }

  if (typeof turn?.startTime === 'number' && typeof turn?.endTime === 'number') {
    evidence.timestamps = {
      end: turn.endTime,
      start: turn.startTime,
    }
  }

  return evidence
}

function getWordMatchRatio(expectedText, actualText) {
  const expectedWords = normalizeWords(expectedText)
  const actualWords = new Set(normalizeWords(actualText))

  if (expectedWords.length === 0) {
    return 0
  }

  const matchedWords = expectedWords.filter((word) => actualWords.has(word)).length
  return matchedWords / expectedWords.length
}

function normalizeComparisonValue(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findMatchingAction(action, executedActions) {
  const actionId = normalizeComparisonValue(action.id)
  const actionName = normalizeComparisonValue(action.name)
  const actionType = normalizeComparisonValue(action.actionType)

  return executedActions.find((executedAction) => {
    return (
      normalizeComparisonValue(executedAction.actionId) === actionId ||
      normalizeComparisonValue(executedAction.actionName) === actionName ||
      normalizeComparisonValue(executedAction.actionType) === actionType
    )
  })
}

function getExtractionCandidates(action) {
  const name = action.name || ''
  const normalizedName = slugify(name)

  return [
    name,
    normalizedName,
    normalizedName.replace(/_/g, ''),
    action.actionParameters?.contactFieldId,
  ].filter(Boolean)
}

function getExtractionValue(extractedData, action) {
  const extractedEntries = Object.entries(extractedData || {})
  const candidates = getExtractionCandidates(action).map(normalizeComparisonValue)

  for (const [key, value] of extractedEntries) {
    if (!candidates.includes(normalizeComparisonValue(key))) {
      continue
    }

    if (value !== null && value !== undefined && value !== '') {
      return value
    }
  }

  return null
}

function getTurnDuration(turn) {
  if (typeof turn.startTime !== 'number' || typeof turn.endTime !== 'number') {
    return 0
  }

  return Math.max(0, turn.endTime - turn.startTime)
}

function getTotalCallDurationFromTurns(turns) {
  const timedTurns = turns.filter(
    (turn) => typeof turn.startTime === 'number' && typeof turn.endTime === 'number'
  )

  if (timedTurns.length === 0) {
    return 0
  }

  const startTime = timedTurns[0].startTime
  const endTime = timedTurns[timedTurns.length - 1].endTime

  return Math.max(0, endTime - startTime)
}

function getConversationAnomalies(turns) {
  let consecutiveAgentTurns = 0
  let maxConsecutiveAgentTurns = 0
  const anomalyIndices = []

  for (const turn of turns) {
    if (turn.role === 'user') {
      consecutiveAgentTurns = 0
      continue
    }

    if (turn.role !== 'agent') {
      continue
    }

    consecutiveAgentTurns += 1
    maxConsecutiveAgentTurns = Math.max(maxConsecutiveAgentTurns, consecutiveAgentTurns)

    if (consecutiveAgentTurns >= MAX_CONSECUTIVE_AGENT_TURNS) {
      anomalyIndices.push(turn.index)
    }
  }

  return { anomalyIndices, maxConsecutiveAgentTurns }
}

function getSilenceGaps(turns) {
  const silenceGaps = []

  for (let index = 1; index < turns.length; index += 1) {
    const previousTurn = turns[index - 1]
    const currentTurn = turns[index]

    if (typeof previousTurn.endTime !== 'number' || typeof currentTurn.startTime !== 'number') {
      continue
    }

    const gapSeconds = currentTurn.startTime - previousTurn.endTime

    if (gapSeconds <= MAX_ALLOWED_GAP_SECONDS) {
      continue
    }

    silenceGaps.push({
      afterTurnIndex: previousTurn.index,
      beforeTurnIndex: currentTurn.index,
      gapSeconds: roundMetric(gapSeconds),
    })
  }

  return silenceGaps
}

function getResponseMetrics(turns) {
  const slowResponses = []
  const responseTimes = []

  for (let index = 0; index < turns.length - 1; index += 1) {
    const currentTurn = turns[index]
    const nextTurn = turns[index + 1]

    if (currentTurn.role !== 'user' || nextTurn.role !== 'agent') {
      continue
    }

    if (typeof currentTurn.endTime !== 'number' || typeof nextTurn.startTime !== 'number') {
      continue
    }

    const responseSeconds = Math.max(0, nextTurn.startTime - currentTurn.endTime)
    responseTimes.push(responseSeconds)

    if (responseSeconds > MAX_ALLOWED_RESPONSE_SECONDS) {
      slowResponses.push({
        agentTurnIndex: nextTurn.index,
        responseSeconds: roundMetric(responseSeconds),
        userTurnIndex: currentTurn.index,
      })
    }
  }

  return { responseTimes, slowResponses }
}

function getTalkRatio(turns) {
  const agentDuration = turns
    .filter((turn) => turn.role === 'agent')
    .reduce((total, turn) => total + getTurnDuration(turn), 0)
  const totalDuration = getTotalCallDurationFromTurns(turns)

  if (totalDuration === 0) {
    return 0
  }

  return roundMetric(agentDuration / totalDuration)
}

function buildSummary(checks) {
  const passed = checks.filter((check) => check.passed).length
  const total = checks.length

  return {
    failed: total - passed,
    passed,
    total,
  }
}

function getFailedRecommendation(message, passed) {
  return passed ? undefined : message
}

function checkGreetingDelivered(turns, agent) {
  const firstAgentTurn = getFirstAgentTurn(turns)
  const expectedGreeting = getWelcomeMessage(agent)
  const actualGreeting = firstAgentTurn?.content || ''
  const wordMatchRatio = roundMetric(getWordMatchRatio(expectedGreeting, actualGreeting))
  const passed = expectedGreeting ? wordMatchRatio >= GREETING_THRESHOLD : Boolean(firstAgentTurn)

  return createCheck({
    category: 'compliance',
    checkId: 'greeting_delivered',
    evidence: buildTurnEvidence(
      firstAgentTurn,
      { text: expectedGreeting, wordMatchThreshold: GREETING_THRESHOLD },
      { text: actualGreeting, wordMatchRatio }
    ),
    label: 'Greeting Message Delivered',
    passed,
    recommendation: getFailedRecommendation(
      'Update the opening line so it more closely matches the configured welcome message.',
      passed
    ),
  })
}

function checkCallDuration(callLog, agent) {
  const maxCallDuration = getMaxCallDuration(agent)
  const passed = maxCallDuration === null ? true : callLog.duration <= maxCallDuration

  return createCheck({
    category: 'timing',
    checkId: 'call_duration_within_limit',
    evidence: {
      actual: { duration: callLog.duration },
      expected: { maxCallDuration },
    },
    label: 'Call Duration Within Limit',
    passed,
    recommendation: getFailedRecommendation(
      `Keep the conversation within ${maxCallDuration} seconds or escalate sooner.`,
      passed
    ),
  })
}

function checkActionsExecution(callLog, agent) {
  const configuredActions = getConfiguredActions(agent)
  const executedActions = Array.isArray(callLog.executedActions) ? callLog.executedActions : []

  return configuredActions.map((action) => {
    const matchedAction = findMatchingAction(action, executedActions)
    const passed = Boolean(matchedAction)

    return createCheck({
      category: 'actions',
      checkId: `action_executed_${slugify(action.name || action.id)}`,
      evidence: {
        actual: {
          executed: passed,
          executedAt: matchedAction?.executedAt || null,
          executedName: matchedAction?.actionName || null,
        },
        expected: {
          actionId: action.id,
          actionName: action.name,
          actionType: action.actionType,
        },
      },
      label: `Action Executed: ${action.name}`,
      passed,
      recommendation: getFailedRecommendation(
        `Ensure the "${action.name}" action triggers when its routing condition is met.`,
        passed
      ),
    })
  })
}

function checkDataExtraction(callLog, agent) {
  const extractedData = callLog.extractedData || {}
  const extractionActions = getConfiguredActions(agent).filter(
    (action) => action.actionType === 'IN_CALL_DATA_EXTRACTION'
  )

  return extractionActions.map((action) => {
    const extractedValue = getExtractionValue(extractedData, action)
    const passed = Boolean(extractedValue)

    return createCheck({
      category: 'extraction',
      checkId: `data_extracted_${slugify(action.name || action.id)}`,
      evidence: {
        actual: {
          extractedFieldKeys: Object.keys(extractedData),
          extractedValue,
        },
        expected: {
          contactFieldId: action.actionParameters?.contactFieldId || null,
          fieldName: action.name,
        },
      },
      label: `Data Extracted: ${action.name}`,
      passed,
      recommendation: getFailedRecommendation(
        `Capture "${action.name}" before ending the conversation.`,
        passed
      ),
    })
  })
}

function checkConversationFlow(turns) {
  const { anomalyIndices, maxConsecutiveAgentTurns } = getConversationAnomalies(turns)
  const silenceGaps = getSilenceGaps(turns)
  const passed = anomalyIndices.length === 0 && silenceGaps.length === 0

  return createCheck({
    category: 'conversation_flow',
    checkId: 'conversation_flow_healthy',
    evidence: {
      actual: {
        agentTalkRatio: getTalkRatio(turns),
        maxConsecutiveAgentTurns,
        silenceGaps,
      },
      expected: {
        maxConsecutiveAgentTurns: MAX_CONSECUTIVE_AGENT_TURNS - 1,
        maxSilenceGapSeconds: MAX_ALLOWED_GAP_SECONDS,
      },
      turnIndices: [...new Set([...anomalyIndices, ...silenceGaps.flatMap((gap) => [gap.afterTurnIndex, gap.beforeTurnIndex])])],
    },
    label: 'Conversation Flow Healthy',
    passed,
    recommendation: getFailedRecommendation(
      'Reduce long dead-air gaps and avoid extended agent monologues without user participation.',
      passed
    ),
  })
}

function checkEndCallProper(turns) {
  const lastAgentTurn = getLastAgentTurn(turns)
  const lastAgentMessage = String(lastAgentTurn?.content || '').toLowerCase()
  const passed = FAREWELL_PATTERNS.some((pattern) => lastAgentMessage.includes(pattern))

  return createCheck({
    category: 'conversation_flow',
    checkId: 'end_call_proper',
    evidence: buildTurnEvidence(
      lastAgentTurn,
      { farewellPatterns: FAREWELL_PATTERNS },
      { text: lastAgentTurn?.content || '' }
    ),
    label: 'Call Ended With Farewell',
    passed,
    recommendation: getFailedRecommendation(
      'Close the conversation with a clear farewell before ending the call.',
      passed
    ),
  })
}

function checkResponseLatency(turns) {
  const { responseTimes, slowResponses } = getResponseMetrics(turns)
  const averageResponseTime = responseTimes.length
    ? roundMetric(responseTimes.reduce((total, value) => total + value, 0) / responseTimes.length)
    : 0
  const maxResponseTime = responseTimes.length ? roundMetric(Math.max(...responseTimes)) : 0
  const passed = slowResponses.length === 0

  return createCheck({
    category: 'timing',
    checkId: 'response_latency',
    evidence: {
      actual: {
        averageResponseTime,
        maxResponseTime,
        slowResponses,
      },
      expected: {
        maxResponseSeconds: MAX_ALLOWED_RESPONSE_SECONDS,
      },
      turnIndices: slowResponses.flatMap((response) => [response.userTurnIndex, response.agentTurnIndex]),
    },
    label: 'Response Latency Acceptable',
    passed,
    recommendation: getFailedRecommendation(
      'Reduce lag after user turns so responses arrive within five seconds.',
      passed
    ),
  })
}

async function runDeterministicEvaluation(callLog, agent) {
  const turns = Array.isArray(callLog.transcriptTurns) ? callLog.transcriptTurns : []
  const checks = [
    checkGreetingDelivered(turns, agent),
    checkCallDuration(callLog, agent),
    ...checkActionsExecution(callLog, agent),
    ...checkDataExtraction(callLog, agent),
    checkConversationFlow(turns),
    checkEndCallProper(turns),
    checkResponseLatency(turns),
  ]

  return {
    checks,
    summary: buildSummary(checks),
  }
}

export {
  checkActionsExecution,
  checkCallDuration,
  checkConversationFlow,
  checkDataExtraction,
  checkEndCallProper,
  checkGreetingDelivered,
  checkResponseLatency,
  runDeterministicEvaluation,
}
