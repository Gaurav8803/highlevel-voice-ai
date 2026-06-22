import { buildRubricPrompt } from '../prompts/rubric-generator.js'
import { buildEvaluationPrompt } from '../prompts/semantic-evaluator.js'

import { prisma } from './prisma.js'
import { llmService } from './llm-service.js'
import { runDeterministicEvaluation } from './deterministic-evaluator.js'

const RUBRIC_MAX_TOKENS = 2000
const SEMANTIC_EVAL_MAX_TOKENS = 3000
const RUBRIC_CACHE_TOLERANCE_MS = 1000

function createAppError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function roundScore(value) {
  return Number(value.toFixed(2))
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isValidRubricItem(item) {
  return isObject(item) &&
    typeof item.id === 'string' &&
    typeof item.category === 'string' &&
    typeof item.description === 'string' &&
    typeof item.successCriteria === 'string' &&
    typeof item.failureCriteria === 'string' &&
    Number.isInteger(item.weight) &&
    item.weight >= 1 &&
    item.weight <= 5 &&
    typeof item.requiresSemanticEval === 'boolean'
}

function assertValidRubric(rubric) {
  if (!isObject(rubric)) {
    throw new Error('Rubric payload must be an object.')
  }

  if (typeof rubric.agentSummary !== 'string' || !Array.isArray(rubric.primaryGoals)) {
    throw new Error('Rubric payload is missing top-level required fields.')
  }

  if (!Array.isArray(rubric.rubricItems) || !rubric.rubricItems.every(isValidRubricItem)) {
    throw new Error('Rubric payload has invalid rubricItems.')
  }
}

function isValidSemanticFinding(finding) {
  return isObject(finding) &&
    Object.prototype.hasOwnProperty.call(finding, 'rubricItemId') &&
    typeof finding.category === 'string' &&
    typeof finding.label === 'string' &&
    ['boolean', 'object'].includes(typeof finding.passed) &&
    typeof finding.confidence === 'number' &&
    finding.confidence >= 0 &&
    finding.confidence <= 1 &&
    finding.source === 'llm_semantic' &&
    isObject(finding.evidence)
}

function assertValidSemanticPayload(payload) {
  if (!isObject(payload)) {
    throw new Error('Semantic evaluation payload must be an object.')
  }

  if (!Array.isArray(payload.findings) || !payload.findings.every(isValidSemanticFinding)) {
    throw new Error('Semantic evaluation payload has invalid findings.')
  }

  if (typeof payload.overallAssessment !== 'string' || !Array.isArray(payload.topRecommendations)) {
    throw new Error('Semantic evaluation payload is missing required summary fields.')
  }
}

function getEvidenceWeightMap(rubric) {
  return new Map((rubric.rubricItems || []).map((item) => [item.id, item.weight]))
}

function getScoreValue(passed) {
  if (passed === true) {
    return 1
  }

  if (passed === false) {
    return 0
  }

  return 0.5
}

function getCheckWeight(item, weightMap) {
  if (item.rubricItemId && weightMap.has(item.rubricItemId)) {
    return weightMap.get(item.rubricItemId)
  }

  return 1
}

function calculateOverallScore(items, rubric) {
  const scorableItems = items.filter((item) => item.passed === true || item.passed === false || item.passed === null)

  if (scorableItems.length === 0) {
    return null
  }

  const weightMap = getEvidenceWeightMap(rubric)
  const weightedTotals = scorableItems.reduce((totals, item) => {
    const weight = getCheckWeight(item, weightMap)

    return {
      score: totals.score + (getScoreValue(item.passed) * weight),
      weight: totals.weight + weight,
    }
  }, { score: 0, weight: 0 })

  if (weightedTotals.weight === 0) {
    return null
  }

  return roundScore((weightedTotals.score / weightedTotals.weight) * 100)
}

function isRubricFresh(agent) {
  if (!agent.rubric || !agent.rubricGeneratedAt || !agent.updatedAt) {
    return false
  }

  return agent.updatedAt.getTime() - agent.rubricGeneratedAt.getTime() <= RUBRIC_CACHE_TOLERANCE_MS
}

function buildDeterministicFindings(deterministicResults) {
  return deterministicResults.checks.map((check) => ({
    category: check.category,
    checkId: check.checkId,
    confidence: check.confidence,
    evidence: check.evidence,
    label: check.label,
    passed: check.passed,
    recommendation: check.recommendation,
    rubricItemId: null,
    source: check.source,
  }))
}

function hasSemanticEvidence(finding) {
  const turnIndices = Array.isArray(finding.evidence?.turnIndices) ? finding.evidence.turnIndices : []
  const quotes = Array.isArray(finding.evidence?.quotes) ? finding.evidence.quotes : []

  return turnIndices.length > 0 || quotes.length > 0
}

function buildRecommendations(deterministicFindings, semanticResults) {
  const deterministicRecommendations = deterministicFindings
    .filter((finding) => finding.passed === false && finding.recommendation)
    .map((finding) => ({
      checkId: finding.checkId,
      label: finding.label,
      recommendation: finding.recommendation,
    }))

  const semanticRecommendations = (semanticResults.topRecommendations || []).map((recommendation) => ({
    description: recommendation.description,
    impactArea: recommendation.impactArea,
    priority: recommendation.priority,
    relatedFindings: recommendation.relatedFindings,
    title: recommendation.title,
  }))

  return [...deterministicRecommendations, ...semanticRecommendations]
}

function normalizeSemanticRubricItemIds(findings, rubric) {
  const validRubricItemIds = new Set((rubric.rubricItems || []).map((item) => item.id))
  let invalidRubricItemCount = 0

  const normalizedFindings = findings.map((finding) => {
    if (finding.rubricItemId === null || validRubricItemIds.has(finding.rubricItemId)) {
      return finding
    }

    invalidRubricItemCount += 1

    return {
      ...finding,
      rubricItemId: null,
    }
  })

  return {
    findings: normalizedFindings,
    invalidRubricItemCount,
  }
}

async function loadAgent(agentId) {
  const agent = await prisma.agent.findUnique({
    where: {
      id: agentId,
    },
  })

  if (!agent) {
    throw createAppError('NOT_FOUND', 'Agent not found.')
  }

  return agent
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
    throw createAppError('NOT_FOUND', 'Call log not found.')
  }

  return callLog
}

async function generateRubric(agentId) {
  const agent = await loadAgent(agentId)

  if (isRubricFresh(agent)) {
    return agent.rubric
  }

  const prompt = buildRubricPrompt(agent)
  let result

  try {
    result = await llmService.completeJson({
      maxTokens: RUBRIC_MAX_TOKENS,
      system: prompt.system,
      user: prompt.user,
    })
  } catch (error) {
    llmService.logger?.error(
      { agentId, error: error.message },
      'Rubric generation request failed'
    )
    throw createAppError('LLM_REQUEST_FAILED', `Rubric generation failed: ${error.message}`)
  }

  try {
    assertValidRubric(result.data)
  } catch (error) {
    llmService.logger?.error(
      { agentId, rawResponse: result.rawText },
      'Rubric generation returned invalid JSON payload'
    )
    throw createAppError('INVALID_LLM_JSON', `Rubric generation returned invalid JSON: ${error.message}`)
  }

  const updatedAgent = await prisma.agent.update({
    data: {
      rubric: result.data,
      rubricGeneratedAt: new Date(),
    },
    where: {
      id: agentId,
    },
  })

  return updatedAgent.rubric
}

async function runSemanticEvaluation(callLog, agent, rubric, deterministicResults) {
  const prompt = buildEvaluationPrompt(agent, rubric, callLog.transcriptTurns || [], deterministicResults)
  let result

  try {
    result = await llmService.completeJson({
      maxTokens: SEMANTIC_EVAL_MAX_TOKENS,
      system: prompt.system,
      user: prompt.user,
    })
  } catch (error) {
    llmService.logger?.error(
      { callLogId: callLog.id, error: error.message },
      'Semantic evaluation request failed'
    )
    throw createAppError('LLM_REQUEST_FAILED', `Semantic evaluation failed: ${error.message}`)
  }

  try {
    assertValidSemanticPayload(result.data)
  } catch (error) {
    llmService.logger?.error(
      { callLogId: callLog.id, rawResponse: result.rawText },
      'Semantic evaluation returned invalid JSON payload'
    )
    throw createAppError('INVALID_LLM_JSON', `Semantic evaluation returned invalid JSON: ${error.message}`)
  }

  return result.data
}

async function evaluateCall(callLogId) {
  const callLog = await loadCallForEvaluation(callLogId)
  const rubric = await generateRubric(callLog.agentId)
  const deterministicResults = await runDeterministicEvaluation(callLog, callLog.agent)
  const semanticResults = await runSemanticEvaluation(callLog, callLog.agent, rubric, deterministicResults)
  const deterministicFindings = buildDeterministicFindings(deterministicResults)
  const normalizedSemanticFindings = normalizeSemanticRubricItemIds(semanticResults.findings, rubric)
  const filteredSemanticFindings = normalizedSemanticFindings.findings.filter(hasSemanticEvidence)
  const rejectedFindingsCount = normalizedSemanticFindings.findings.length - filteredSemanticFindings.length

  llmService.logger?.info(
    {
      callLogId,
      invalidRubricItemCount: normalizedSemanticFindings.invalidRubricItemCount,
      rejectedFindingsCount,
    },
    'Applied semantic evidence policy'
  )

  const mergedFindings = [...deterministicFindings, ...filteredSemanticFindings]
  const filteredSemanticResults = {
    ...semanticResults,
    findings: filteredSemanticFindings,
    invalidRubricItemCount: normalizedSemanticFindings.invalidRubricItemCount,
    rejectedFindingsCount,
  }

  return prisma.callEvaluation.upsert({
    create: {
      agentId: callLog.agentId,
      callLogId,
      deterministicResults,
      evaluatedAt: new Date(),
      findings: mergedFindings,
      overallScore: calculateOverallScore(mergedFindings, rubric),
      recommendations: buildRecommendations(deterministicFindings, filteredSemanticResults),
      semanticResults: filteredSemanticResults,
    },
    update: {
      deterministicResults,
      evaluatedAt: new Date(),
      findings: mergedFindings,
      overallScore: calculateOverallScore(mergedFindings, rubric),
      recommendations: buildRecommendations(deterministicFindings, filteredSemanticResults),
      semanticResults: filteredSemanticResults,
    },
    where: {
      callLogId,
    },
  })
}

async function evaluateAllCalls(agentId) {
  await loadAgent(agentId)

  const calls = await prisma.callLog.findMany({
    where: {
      agentId,
      evaluation: {
        is: null,
      },
    },
  })

  let evaluatedCount = 0
  let failedCount = 0
  const errors = []

  for (const callLog of calls) {
    try {
      await evaluateCall(callLog.id)
      evaluatedCount += 1
    } catch (error) {
      failedCount += 1
      errors.push({
        callLogId: callLog.id,
        message: error.message,
      })
    }
  }

  return {
    errors,
    evaluatedCount,
    failedCount,
    totalFound: calls.length,
  }
}

export { evaluateAllCalls, evaluateCall, generateRubric }
