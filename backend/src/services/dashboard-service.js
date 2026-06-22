import { evaluateAllCalls, generateRubric } from './evaluation-service.js'
import { syncAgents, syncCallLogs } from './ingestion-service.js'
import { prisma } from './prisma.js'

const TREND_DELTA_THRESHOLD = 5

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

function getFailedFindings(findings) {
  return ensureArray(findings).filter((finding) => finding?.passed !== true && getFindingLabel(finding))
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

function extractCheckGroups(evaluations, predicate) {
  const checks = []

  for (const evaluation of evaluations) {
    const evaluationChecks = ensureArray(evaluation.deterministicResults?.checks)
    for (const check of evaluationChecks) {
      if (predicate(check)) {
        checks.push(check)
      }
    }
  }

  return checks
}

function getActionNameFromCheck(check) {
  return String(check.label || '').replace(/^Action Executed:\s*/, '').trim()
}

function buildActionSuccessRates(evaluations) {
  const checks = extractCheckGroups(evaluations, (check) => check.category === 'actions' && check.label?.startsWith('Action Executed:'))
  const actionStats = new Map()

  for (const check of checks) {
    const actionName = getActionNameFromCheck(check)
    const current = actionStats.get(actionName) || { actionName, attempted: 0, succeeded: 0 }
    current.attempted += 1
    current.succeeded += check.passed ? 1 : 0
    actionStats.set(actionName, current)
  }

  return [...actionStats.values()]
    .map((stat) => ({
      ...stat,
      rate: stat.attempted ? roundMetric((stat.succeeded / stat.attempted) * 100) : 0,
    }))
    .sort((left, right) => right.attempted - left.attempted || left.actionName.localeCompare(right.actionName))
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
        description: recommendation.description || recommendation.recommendation || null,
        frequency: 0,
        impactArea: recommendation.impactArea || null,
        priority: recommendation.priority ?? null,
        relatedFindings: ensureArray(recommendation.relatedFindings),
        title,
      }
      current.frequency += 1
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

function getAverageResponseLatency(evaluations) {
  const checks = extractCheckGroups(evaluations, (check) => check.checkId === 'response_latency')
  const values = getNumericValues(checks.map((check) => check.evidence?.actual?.averageResponseTime))
  return average(values)
}

function getExtractionCompleteness(evaluations) {
  const checks = extractCheckGroups(evaluations, (check) => check.category === 'extraction')

  if (checks.length === 0) {
    return 0
  }

  const capturedCount = checks.filter((check) => check.passed).length
  return roundMetric((capturedCount / checks.length) * 100)
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
      take: 5,
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
        id: true,
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

  return {
    agent,
    calls: calls.map((callLog) => ({
      calledAt: callLog.calledAt,
      duration: callLog.duration,
      id: callLog.id,
      overallScore: evaluations.find((evaluation) => evaluation.callLogId === callLog.id)?.overallScore ?? null,
    })),
    metrics: {
      actionSuccessRates: buildActionSuccessRates(evaluations),
      averageDuration: average(durations),
      averageResponseLatency: getAverageResponseLatency(evaluations),
      averageScore: average(evaluationScores),
      extractionCompleteness: getExtractionCompleteness(evaluations),
      findingFrequency: buildFindingFrequency(evaluations),
      scoreOverTime: [...evaluations]
        .reverse()
        .filter((evaluation) => typeof evaluation.overallScore === 'number')
        .map(serializeScorePoint),
      totalCalls: calls.length,
    },
    recentEvaluations: evaluations.slice(0, 10).map(buildRecentEvaluationSummary),
    topRecommendations: buildTopRecommendations(evaluations),
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

  const sortedFindings = ensureArray(callLog.evaluation?.findings)
    .slice()
    .sort((left, right) => (right.confidence || 0) - (left.confidence || 0))

  return {
    agent: {
      agentName: callLog.agent.agentName,
      businessName: callLog.agent.businessName,
      rubricSummary: callLog.agent.rubric
        ? {
          agentSummary: callLog.agent.rubric.agentSummary || null,
          primaryGoals: ensureArray(callLog.agent.rubric.primaryGoals),
          rubricItemCount: ensureArray(callLog.agent.rubric.rubricItems).length,
        }
        : null,
    },
    call: callLog,
    evaluation: callLog.evaluation
      ? {
        allFindings: sortedFindings,
        deterministicResults: callLog.evaluation.deterministicResults,
        evaluatedAt: callLog.evaluation.evaluatedAt,
        overallScore: callLog.evaluation.overallScore,
        recommendations: ensureArray(callLog.evaluation.recommendations),
        semanticResults: callLog.evaluation.semanticResults,
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

  for (const agent of agents) {
    try {
      await generateRubric(agent.id)
      generatedCount += 1
    } catch (error) {
      errors.push({
        agentId: agent.id,
        message: error.message,
      })
    }
  }

  return { errors, generatedCount }
}

async function evaluateUnevaluatedCalls(agents) {
  const summaries = []

  for (const agent of agents) {
    summaries.push({
      agentId: agent.id,
      ...await evaluateAllCalls(agent.id),
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
  const evaluationSummary = await evaluateUnevaluatedCalls(agents)

  return {
    agentSync,
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
