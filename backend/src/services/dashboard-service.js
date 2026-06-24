import { evaluateAllCalls, generateRubric } from './evaluation-service.js'
import { syncAgents, syncCallLogs } from './ingestion-service.js'
import { prisma } from './prisma.js'

const TREND_DELTA_THRESHOLD = 5
const ACTION_RELATED_CHECK_TYPES = new Set([
  'action_triggered',
  'appointment_offered',
  'consent_obtained',
  'escalation',
])
const EXTRACTION_CHECK_TYPES = new Set(['data_extracted'])
const SEVERITY_PRIORITY = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
}

function createAppError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function roundMetric(value) {
  return Number(value.toFixed(2))
}

function getEvidenceStrengthRank(finding) {
  const evidenceStrength = finding?.evidenceStrength

  if (evidenceStrength === 'strong') {
    return 3
  }

  if (evidenceStrength === 'medium') {
    return 2
  }

  if (evidenceStrength === 'weak') {
    return 1
  }

  const confidence = finding?.confidence

  if (typeof confidence === 'number' && Number.isFinite(confidence)) {
    return confidence
  }

  return 0
}

function normalizeFindingEvidenceStrength(finding) {
  if (!finding || typeof finding !== 'object') {
    return finding
  }

  if (finding.evidenceStrength) {
    return finding
  }

  const confidence = finding.confidence
  let evidenceStrength = 'weak'

  if (typeof confidence === 'number' && Number.isFinite(confidence)) {
    if (confidence >= 0.8) {
      evidenceStrength = 'strong'
    } else if (confidence >= 0.5) {
      evidenceStrength = 'medium'
    }
  }

  return {
    ...finding,
    confidence: undefined,
    evidenceStrength,
  }
}

function average(values) {
  if (values.length === 0) {
    return 0
  }

  return roundMetric(values.reduce((total, value) => total + value, 0) / values.length)
}

function getNumericValues(values) {
  return values.filter((value) => typeof value === 'number' && Number.isFinite(value))
}

function getFindingLabel(finding) {
  return finding?.label || null
}

function getUseActionType(finding) {
  if (finding?.category === 'communication' || finding?.category === 'objection_handling') {
    return 'script_training'
  }

  return 'workflow_fix'
}

function getSeverityPriority(value) {
  return SEVERITY_PRIORITY[value] || Number.POSITIVE_INFINITY
}

function getFailedFindings(findings) {
  return ensureArray(findings).filter((finding) => {
    if (!getFindingLabel(finding)) {
      return false
    }

    if (finding?.status) {
      return finding.status !== 'passed'
    }

    return finding?.passed !== true
  })
}

function getTopIssueLabel(evaluations) {
  const counts = new Map()

  for (const evaluation of evaluations) {
    for (const finding of getFailedFindings(evaluation.findings)) {
      const label = getFindingLabel(finding)
      counts.set(label, (counts.get(label) || 0) + 1)
    }
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null
}

function getIssuesFoundCount(evaluations) {
  return evaluations.reduce(
    (total, evaluation) => total + getFailedFindings(evaluation.findings).length,
    0
  )
}

function getTrend(scoresDescending) {
  const recentScores = scoresDescending.slice(0, 5)
  const previousScores = scoresDescending.slice(5, 10)

  if (recentScores.length === 0 || previousScores.length === 0) {
    return 'stable'
  }

  const delta = average(recentScores) - average(previousScores)

  if (delta >= TREND_DELTA_THRESHOLD) {
    return 'improving'
  }

  if (delta <= -TREND_DELTA_THRESHOLD) {
    return 'declining'
  }

  return 'stable'
}

function serializeRecentCall(callLog) {
  const topFinding = getFailedFindings(callLog.evaluation?.findings || [])[0]?.label || null

  return {
    agentId: callLog.agentId,
    agentName: callLog.agent?.agentName || null,
    businessName: callLog.agent?.businessName || null,
    calledAt: callLog.calledAt,
    duration: callLog.duration,
    id: callLog.id,
    overallScore: callLog.evaluation?.overallScore ?? null,
    scoreEvaluatedAt: callLog.evaluation?.evaluatedAt ?? null,
    summary: callLog.summary,
    topFinding,
  }
}

function serializeScorePoint(evaluation) {
  return {
    date: evaluation.callLog?.calledAt || evaluation.evaluatedAt,
    score: evaluation.overallScore ?? 0,
  }
}

function buildFindingFrequency(evaluations) {
  const counts = new Map()

  for (const evaluation of evaluations) {
    for (const finding of getFailedFindings(evaluation.findings)) {
      const key = `${finding.category}::${finding.label}`
      const current = counts.get(key) || {
        category: finding.category,
        count: 0,
        finding: finding.label,
        sampleEvidence: {
          quotes: ensureArray(finding.evidence?.quotes).slice(0, 2),
          reasoning: finding.evidence?.reasoning || null,
          turnIndices: ensureArray(finding.evidence?.turnIndices).slice(0, 4),
        },
      }
      current.count += 1
      counts.set(key, current)
    }
  }

  return [...counts.values()].sort((left, right) => right.count - left.count || left.finding.localeCompare(right.finding))
}

function buildRecentEvaluationSummary(evaluation) {
  return {
    callLogId: evaluation.callLogId,
    calledAt: evaluation.callLog?.calledAt || null,
    findingsCount: ensureArray(evaluation.findings).length,
    id: evaluation.id,
    topFailedFindings: getFailedFindings(evaluation.findings).map((finding) => finding.label).slice(0, 3),
    overallScore: evaluation.overallScore ?? 0,
    evaluatedAt: evaluation.evaluatedAt,
  }
}

function buildTopRecommendations(evaluations) {
  const counts = new Map()

  for (const evaluation of evaluations) {
    for (const recommendation of ensureArray(evaluation.recommendations)) {
      const title = recommendation.title || recommendation.label || recommendation.recommendation

      if (!title) {
        continue
      }

      const current = counts.get(title) || {
        actionAdjustment: recommendation.actionAdjustment || null,
        description: recommendation.description || recommendation.recommendation || null,
        frequency: 0,
        impactArea: recommendation.impactArea || null,
        priority: recommendation.priority ?? null,
        promptPatch: recommendation.promptPatch || null,
        relatedRubricItems: ensureArray(recommendation.relatedRubricItems),
        suggestedChange: recommendation.suggestedChange || null,
        title,
      }
      current.frequency += 1

      if (!current.description && recommendation.description) {
        current.description = recommendation.description
      }

      if (!current.impactArea && recommendation.impactArea) {
        current.impactArea = recommendation.impactArea
      }

      if (current.priority === null && recommendation.priority !== null && recommendation.priority !== undefined) {
        current.priority = recommendation.priority
      }

      if ((!current.suggestedChange || current.suggestedChange.length === 0) && recommendation.suggestedChange) {
        current.suggestedChange = recommendation.suggestedChange
      }

      if ((!current.promptPatch || current.promptPatch.length === 0) && recommendation.promptPatch) {
        current.promptPatch = recommendation.promptPatch
      }

      if ((!current.actionAdjustment || current.actionAdjustment.length === 0) && recommendation.actionAdjustment) {
        current.actionAdjustment = recommendation.actionAdjustment
      }

      if (current.relatedRubricItems.length === 0 && ensureArray(recommendation.relatedRubricItems).length > 0) {
        current.relatedRubricItems = ensureArray(recommendation.relatedRubricItems)
      }

      counts.set(title, current)
    }
  }

  return [...counts.values()].sort((left, right) => {
    const leftPriority = left.priority ?? Number.POSITIVE_INFINITY
    const rightPriority = right.priority ?? Number.POSITIVE_INFINITY

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }

    return right.frequency - left.frequency || left.title.localeCompare(right.title)
  })
}

function buildCallUseActions(evaluation) {
  return getFailedFindings(evaluation?.findings).map((finding, index) => ({
    actionType: getUseActionType(finding),
    finding: finding.label,
    id: `${finding.rubricItemId || finding.id || finding.label}-${index}`,
    quotes: ensureArray(finding.evidence?.quotes).slice(0, 2),
    recommendation: finding.recommendation || finding.evidence?.reasoning || 'Review this call segment and update the script or workflow.',
    severity: finding.severity || null,
    status: finding.status || (finding.passed === false ? 'failed' : 'uncertain'),
    turnIndices: ensureArray(finding.evidence?.turnIndices).slice(0, 6),
  }))
}

function buildAgentUseActions(evaluations) {
  const counts = new Map()

  for (const evaluation of evaluations) {
    for (const action of buildCallUseActions(evaluation)) {
      const key = `${action.actionType}::${action.finding}`
      const current = counts.get(key) || {
        actionType: action.actionType,
        affectedCalls: 0,
        finding: action.finding,
        quotes: action.quotes,
        recommendation: action.recommendation,
        severity: action.severity,
        turnIndices: action.turnIndices,
      }

      current.affectedCalls += 1

      if (getSeverityPriority(action.severity) < getSeverityPriority(current.severity)) {
        current.severity = action.severity
      }

      if (current.quotes.length === 0 && action.quotes.length > 0) {
        current.quotes = action.quotes
      }

      if (current.turnIndices.length === 0 && action.turnIndices.length > 0) {
        current.turnIndices = action.turnIndices
      }

      counts.set(key, current)
    }
  }

  return [...counts.values()].sort((left, right) => {
    const severityDelta = getSeverityPriority(left.severity) - getSeverityPriority(right.severity)

    if (severityDelta !== 0) {
      return severityDelta
    }

    if (left.affectedCalls !== right.affectedCalls) {
      return right.affectedCalls - left.affectedCalls
    }

    return left.finding.localeCompare(right.finding)
  })
}

function getSemanticEvaluationItems(callLog) {
  return ensureArray(callLog?.evaluation?.semanticResults?.evaluatedRubricItems)
}

function getOutOfScopeItems(callLog) {
  return ensureArray(callLog?.evaluation?.outOfScopeItems)
}

function getRubricItemMap(rubric) {
  return new Map(getRubricItems(rubric).map((item) => [item.id, item]))
}

function getStatusScore(status) {
  if (status === 'passed') {
    return 1
  }

  if (status === 'partially_met') {
    return 0.5
  }

  if (status === 'failed') {
    return 0
  }

  return null
}

function createStatusAggregate(seed = {}) {
  return {
    applicableCount: 0,
    failedCount: 0,
    passedCount: 0,
    partiallyMetCount: 0,
    scoreTotal: 0,
    scorableCount: 0,
    uncertainCount: 0,
    ...seed,
  }
}

function registerEvaluationStatus(aggregate, status) {
  aggregate.applicableCount += 1

  if (status === 'passed') {
    aggregate.passedCount += 1
  } else if (status === 'partially_met') {
    aggregate.partiallyMetCount += 1
  } else if (status === 'failed') {
    aggregate.failedCount += 1
  } else {
    aggregate.uncertainCount += 1
  }

  const statusScore = getStatusScore(status)

  if (statusScore !== null) {
    aggregate.scoreTotal += statusScore
    aggregate.scorableCount += 1
  }
}

function finalizeStatusAggregate(aggregate) {
  return {
    ...aggregate,
    rate: aggregate.scorableCount
      ? roundMetric((aggregate.scoreTotal / aggregate.scorableCount) * 100)
      : null,
  }
}

function buildActionSuccessRates(calls, rubric) {
  const rubricItemMap = getRubricItemMap(rubric)
  const actionStats = new Map()

  for (const callLog of calls) {
    for (const finding of getSemanticEvaluationItems(callLog)) {
      const rubricItem = rubricItemMap.get(finding.rubricItemId)

      if (!rubricItem || !ACTION_RELATED_CHECK_TYPES.has(rubricItem.checkType)) {
        continue
      }

      const current = actionStats.get(rubricItem.id) || createStatusAggregate({
        actionName: rubricItem.label,
        checkType: rubricItem.checkType,
        severity: rubricItem.severity,
      })

      registerEvaluationStatus(current, finding.status)
      actionStats.set(rubricItem.id, current)
    }
  }

  return [...actionStats.values()]
    .map(finalizeStatusAggregate)
    .sort((left, right) => {
      const severityDelta = getSeverityPriority(left.severity) - getSeverityPriority(right.severity)

      if (severityDelta !== 0) {
        return severityDelta
      }

      const leftRate = left.rate ?? -1
      const rightRate = right.rate ?? -1

      if (leftRate !== rightRate) {
        return leftRate - rightRate
      }

      return right.applicableCount - left.applicableCount || left.actionName.localeCompare(right.actionName)
    })
}

function getNumericTimestamp(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getResponseLatencyValues(turns) {
  const normalizedTurns = ensureArray(turns)
  const latencies = []

  for (let index = 0; index < normalizedTurns.length - 1; index += 1) {
    const currentTurn = normalizedTurns[index]
    const nextTurn = normalizedTurns[index + 1]

    if (currentTurn?.role !== 'user' || nextTurn?.role !== 'agent') {
      continue
    }

    const currentEnd = getNumericTimestamp(currentTurn.endTime)
    const nextStart = getNumericTimestamp(nextTurn.startTime)

    if (currentEnd === null || nextStart === null) {
      continue
    }

    const latency = nextStart - currentEnd

    if (latency >= 0) {
      latencies.push(latency)
    }
  }

  return latencies
}

function getAverageResponseLatency(calls) {
  const responseLatencies = calls.flatMap((callLog) => getResponseLatencyValues(callLog.transcriptTurns))
  return average(responseLatencies)
}

function getExtractionCompleteness(calls, rubric) {
  const rubricItemMap = getRubricItemMap(rubric)
  const aggregate = createStatusAggregate()

  for (const callLog of calls) {
    for (const finding of getSemanticEvaluationItems(callLog)) {
      const rubricItem = rubricItemMap.get(finding.rubricItemId)

      if (!rubricItem || !EXTRACTION_CHECK_TYPES.has(rubricItem.checkType)) {
        continue
      }

      registerEvaluationStatus(aggregate, finding.status)
    }
  }

  return finalizeStatusAggregate(aggregate).rate || 0
}

function getRubricItems(rubric) {
  return ensureArray(rubric?.rubric)
}

function buildAgentSummary(agent) {
  const evaluatedScores = getNumericValues(agent.evaluations.map((evaluation) => evaluation.overallScore))

  return {
    agentId: agent.id,
    agentName: agent.agentName,
    averageScore: average(evaluatedScores),
    businessName: agent.businessName,
    callCount: agent._count.callLogs,
    evaluatedCount: agent.evaluations.length,
    topIssue: getTopIssueLabel(agent.evaluations),
    trend: getTrend(evaluatedScores),
  }
}

async function getDashboardOverview() {
  const [totalAgents, totalCalls, totalEvaluated, scoreAggregate, recentCalls, agents] = await Promise.all([
    prisma.agent.count(),
    prisma.callLog.count(),
    prisma.callEvaluation.count(),
    prisma.callEvaluation.aggregate({ _avg: { overallScore: true } }),
    prisma.callLog.findMany({
      include: {
        agent: {
          select: {
            agentName: true,
            businessName: true,
          },
        },
        evaluation: {
          select: {
            findings: true,
            evaluatedAt: true,
            overallScore: true,
          },
        },
      },
      orderBy: {
        calledAt: 'desc',
      },
    }),
    prisma.agent.findMany({
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
            findings: true,
            overallScore: true,
            evaluatedAt: true,
          },
        },
      },
      orderBy: {
        agentName: 'asc',
      },
    }),
  ])

  const issuesFound = agents.reduce(
    (total, agent) => total + getIssuesFoundCount(agent.evaluations),
    0
  )

  return {
    averageScore: roundMetric(scoreAggregate._avg.overallScore || 0),
    agentSummaries: agents.map(buildAgentSummary),
    issuesFound,
    recentCalls: recentCalls.map(serializeRecentCall),
    totalAgents,
    totalCalls,
    totalEvaluated,
  }
}

async function loadAgentDashboardContext(agentId) {
  const agent = await prisma.agent.findUnique({
    select: {
      agentAnalysis: true,
      agentAnalysisGeneratedAt: true,
      agentName: true,
      businessName: true,
      id: true,
      rubric: true,
    },
    where: {
      id: agentId,
    },
  })

  if (!agent) {
    throw createAppError('NOT_FOUND', 'Agent not found.')
  }

  const [calls, evaluations] = await Promise.all([
    prisma.callLog.findMany({
      orderBy: {
        calledAt: 'desc',
      },
      select: {
        calledAt: true,
        duration: true,
        evaluation: {
          select: {
            outOfScopeItems: true,
            overallScore: true,
            semanticResults: true,
          },
        },
        id: true,
        transcriptTurns: true,
      },
      where: {
        agentId,
      },
    }),
    prisma.callEvaluation.findMany({
      include: {
        callLog: {
          select: {
            calledAt: true,
            duration: true,
          },
        },
      },
      orderBy: {
        evaluatedAt: 'desc',
      },
      where: {
        agentId,
      },
    }),
  ])

  return { agent, calls, evaluations }
}

async function getAgentDashboard(agentId) {
  const { agent, calls, evaluations } = await loadAgentDashboardContext(agentId)
  const evaluationScores = getNumericValues(evaluations.map((evaluation) => evaluation.overallScore))
  const durations = getNumericValues(calls.map((callLog) => callLog.duration))
  const agentAnalysis = agent.agentAnalysis || null

  return {
    agent,
    agentAnalysis,
    agentAnalysisGeneratedAt: agent.agentAnalysisGeneratedAt || null,
    calls: calls.map((callLog) => ({
      calledAt: callLog.calledAt,
      duration: callLog.duration,
      id: callLog.id,
      overallScore: callLog.evaluation?.overallScore ?? null,
    })),
    metrics: {
      actionSuccessRates: buildActionSuccessRates(calls, agent.rubric),
      averageDuration: average(durations),
      averageResponseLatency: getAverageResponseLatency(calls),
      averageScore: average(evaluationScores),
      extractionCompleteness: getExtractionCompleteness(calls, agent.rubric),
      findingFrequency: buildFindingFrequency(evaluations),
      scoreOverTime: [...evaluations]
        .reverse()
        .filter((evaluation) => typeof evaluation.overallScore === 'number')
        .map(serializeScorePoint),
      totalCalls: calls.length,
    },
    recentEvaluations: evaluations.slice(0, 10).map(buildRecentEvaluationSummary),
    topRecommendations: ensureArray(agentAnalysis?.topRecommendations).length
      ? ensureArray(agentAnalysis.topRecommendations)
      : buildTopRecommendations(evaluations),
    useActions: buildAgentUseActions(evaluations),
  }
}

async function getCallDashboard(callId) {
  const callLog = await prisma.callLog.findUnique({
    include: {
      agent: {
        select: {
          agentName: true,
          businessName: true,
          id: true,
          rubric: true,
        },
      },
      evaluation: true,
    },
    where: {
      id: callId,
    },
  })

  if (!callLog) {
    throw createAppError('NOT_FOUND', 'Call log not found.')
  }

  return {
    agent: {
      agentName: callLog.agent.agentName,
      businessName: callLog.agent.businessName,
      rubricSummary: callLog.agent.rubric
        ? {
          agentGoalSummary: callLog.agent.rubric.agentGoalSummary || null,
          primaryGoals: ensureArray(callLog.agent.rubric.primaryGoals),
          totalRubricItems: getRubricItems(callLog.agent.rubric).length,
        }
        : null,
    },
    call: {
      agentId: callLog.agentId,
      calledAt: callLog.calledAt,
      contactId: callLog.contactId,
      createdAt: callLog.createdAt,
      duration: callLog.duration,
      executedActions: callLog.executedActions,
      extractedData: callLog.extractedData,
      ghlCallId: callLog.ghlCallId,
      id: callLog.id,
      rawResponse: callLog.rawResponse,
      summary: callLog.summary,
      transcript: callLog.transcript,
      transcriptTurns: callLog.transcriptTurns,
    },
    evaluation: callLog.evaluation
      ? {
        callPath: callLog.evaluation.callPath,
        emergentFindings: ensureArray(callLog.evaluation.semanticResults?.emergentFindings)
          .map(normalizeFindingEvidenceStrength)
          .slice()
          .sort((left, right) => getEvidenceStrengthRank(right) - getEvidenceStrengthRank(left)),
        evaluatedAt: callLog.evaluation.evaluatedAt,
        evaluatedRubricItems: ensureArray(callLog.evaluation.semanticResults?.evaluatedRubricItems)
          .map(normalizeFindingEvidenceStrength)
          .slice()
          .sort((left, right) => getEvidenceStrengthRank(right) - getEvidenceStrengthRank(left)),
        outOfScopeItems: ensureArray(callLog.evaluation.outOfScopeItems),
        overallScore: callLog.evaluation.overallScore,
        recommendations: ensureArray(callLog.evaluation.recommendations),
        useActions: buildCallUseActions(callLog.evaluation),
      }
      : null,
  }
}

function getRubricCandidates(agents) {
  return agents.filter((agent) => !agent.rubric || agent.configHash !== agent.rubricConfigHash)
}

async function generateNeededRubrics(agents) {
  let generatedCount = 0
  const errors = []
  const regeneratedAgentIds = []

  for (const agent of agents) {
    try {
      await generateRubric(agent.id)
      generatedCount += 1
      regeneratedAgentIds.push(agent.id)
    } catch (error) {
      errors.push({
        agentId: agent.id,
        message: error.message,
      })
    }
  }

  return { errors, generatedCount, regeneratedAgentIds }
}

async function generateAgentAnalyses(agents) {
  let generatedCount = 0
  const errors = []

  for (const agent of agents) {
    try {
      const result = await generateAgentAnalysis(agent.id)

      if (result.analysis) {
        generatedCount += 1
      }
    } catch (error) {
      errors.push({
        agentId: agent.id,
        message: error.message,
      })
    }
  }

  return {
    errors,
    generatedCount,
  }
}

async function evaluateCallsForAgents(agents, options = {}) {
  const { forceAgentIds = [] } = options
  const forcedAgentIdSet = new Set(forceAgentIds)
  const summaries = []

  for (const agent of agents) {
    summaries.push({
      agentId: agent.id,
      ...await evaluateAllCalls(agent.id, {
        force: forcedAgentIdSet.has(agent.id),
      }),
    })
  }

  return {
    agentSummaries: summaries,
    errors: summaries.flatMap((summary) => summary.errors),
    evaluatedCount: summaries.reduce((total, summary) => total + summary.evaluatedCount, 0),
    failedCount: summaries.reduce((total, summary) => total + summary.failedCount, 0),
    totalFound: summaries.reduce((total, summary) => total + summary.totalFound, 0),
  }
}

async function syncAndEvaluateDashboard() {
  const agentSync = await syncAgents()
  const callSync = await syncCallLogs()
  const agents = await prisma.agent.findMany({
    select: {
      configHash: true,
      id: true,
      rubric: true,
      rubricConfigHash: true,
    },
  })
  const rubricGeneration = await generateNeededRubrics(getRubricCandidates(agents))
  const evaluationSummary = await evaluateCallsForAgents(agents, {
    forceAgentIds: rubricGeneration.regeneratedAgentIds,
  })
  const agentAnalysisSummary = await generateAgentAnalyses(agents)

  return {
    agentSync,
    agentAnalysisSummary,
    callSync,
    evaluationSummary,
    rubricGeneration,
  }
}

export {
  getAgentDashboard,
  getCallDashboard,
  getDashboardOverview,
  syncAndEvaluateDashboard,
}
