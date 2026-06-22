import { prisma } from './prisma.js'
import { runDeterministicEvaluation } from './deterministic-evaluator.js'

function createNotFoundError(message) {
  const error = new Error(message)
  error.code = 'NOT_FOUND'
  return error
}

function roundScore(value) {
  return Number(value.toFixed(2))
}

function buildFindings(checks) {
  return checks
    .filter((check) => !check.passed)
    .map((check) => ({
      category: check.category,
      checkId: check.checkId,
      confidence: check.confidence,
      evidence: check.evidence,
      label: check.label,
      passed: check.passed,
      source: check.source,
    }))
}

function buildRecommendations(checks) {
  return checks
    .filter((check) => !check.passed && check.recommendation)
    .map((check) => ({
      checkId: check.checkId,
      label: check.label,
      recommendation: check.recommendation,
    }))
}

function getOverallScore(summary) {
  if (summary.total === 0) {
    return null
  }

  return roundScore((summary.passed / summary.total) * 100)
}

async function loadCallForEvaluation(callLogId) {
  const callLog = await prisma.callLog.findUnique({
    include: {
      agent: true,
    },
    where: {
      id: callLogId,
    },
  })

  if (!callLog) {
    throw createNotFoundError('Call log not found.')
  }

  return callLog
}

async function evaluateCall(callLogId) {
  const callLog = await loadCallForEvaluation(callLogId)
  const deterministicResults = await runDeterministicEvaluation(callLog, callLog.agent)
  const findings = buildFindings(deterministicResults.checks)
  const recommendations = buildRecommendations(deterministicResults.checks)

  return prisma.callEvaluation.upsert({
    create: {
      agentId: callLog.agentId,
      callLogId,
      deterministicResults,
      evaluatedAt: new Date(),
      findings,
      overallScore: getOverallScore(deterministicResults.summary),
      recommendations,
      semanticResults: {},
    },
    update: {
      deterministicResults,
      evaluatedAt: new Date(),
      findings,
      overallScore: getOverallScore(deterministicResults.summary),
      recommendations,
      semanticResults: {},
    },
    where: {
      callLogId,
    },
  })
}

export { evaluateCall }
