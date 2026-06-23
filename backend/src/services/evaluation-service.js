import { buildRubricPrompt } from '../prompts/rubric-generator.js'
import { buildEvaluationPrompt } from '../prompts/semantic-evaluator.js'

import { computeAgentConfigHash } from '../utils/hashing.js'
import { prisma } from './prisma.js'
import { llmService } from './llm-service.js'
import { runDeterministicEvaluation } from './deterministic-evaluator.js'

const RUBRIC_MAX_TOKENS = 8000
const SEMANTIC_EVAL_MAX_TOKENS = 8000
const VALID_EVALUATION_MODES = new Set(['semantic', 'structured_evidence'])
const VALID_EVIDENCE_REQUIRED = new Set(['transcript', 'extracted_data', 'actions', 'any'])
const RUBRIC_SEVERITY_WEIGHTS = {
  critical: 4,
  high: 3,
  low: 1,
  medium: 2,
}
const VALID_EVIDENCE_STRENGTHS = new Set(['strong', 'medium', 'weak'])
const VALID_EVALUATION_STATUSES = new Set(['passed', 'failed', 'partially_met', 'uncertain'])

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
    typeof item.label === 'string' &&
    typeof item.description === 'string' &&
    typeof item.checkType === 'string' &&
    typeof item.successCondition === 'string' &&
    typeof item.failureCondition === 'string' &&
    typeof item.applicability === 'string' &&
    typeof item.triggerCondition === 'string' &&
    typeof item.outOfScopeCondition === 'string' &&
    typeof item.recommendationHint === 'string' &&
    VALID_EVALUATION_MODES.has(item.evaluationMode) &&
    Array.isArray(item.evidenceRequired) &&
    item.evidenceRequired.length > 0 &&
    item.evidenceRequired.every((entry) => VALID_EVIDENCE_REQUIRED.has(entry)) &&
    typeof item.severity === 'string' &&
    item.id.length > 0
}

function assertValidRubric(rubric) {
  if (!isObject(rubric)) {
    throw new Error('Rubric payload must be an object.')
  }

  if (typeof rubric.agentGoalSummary !== 'string' || !Array.isArray(rubric.primaryGoals)) {
    throw new Error('Rubric payload is missing top-level required fields.')
  }

  if (!Array.isArray(rubric.rubric) || !rubric.rubric.every(isValidRubricItem)) {
    throw new Error('Rubric payload has invalid rubric items.')
  }

  const itemIds = rubric.rubric.map((item) => item.id)
  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error('Rubric payload contains duplicate rubric item ids.')
  }
}

function isValidSemanticFinding(finding) {
  return isObject(finding) &&
    typeof finding.rubricItemId === 'string' &&
    typeof finding.category === 'string' &&
    typeof finding.label === 'string' &&
    typeof finding.severity === 'string' &&
    VALID_EVALUATION_STATUSES.has(finding.status) &&
    VALID_EVIDENCE_STRENGTHS.has(finding.evidenceStrength) &&
    isObject(finding.evidence) &&
    (
      finding.recommendation === undefined ||
      finding.recommendation === null ||
      typeof finding.recommendation === 'string'
    )
}

function isValidOutOfScopeItem(item) {
  return isObject(item) &&
    typeof item.rubricItemId === 'string' &&
    typeof item.label === 'string' &&
    typeof item.reason === 'string'
}

function isValidEmergentFinding(finding) {
  return isObject(finding) &&
    typeof finding.id === 'string' &&
    typeof finding.label === 'string' &&
    typeof finding.category === 'string' &&
    typeof finding.severity === 'string' &&
    VALID_EVALUATION_STATUSES.has(finding.status) &&
    VALID_EVIDENCE_STRENGTHS.has(finding.evidenceStrength) &&
    isObject(finding.evidence) &&
    (
      finding.recommendation === undefined ||
      finding.recommendation === null ||
      typeof finding.recommendation === 'string'
    )
}

function assertValidSemanticPayload(payload) {
  if (!isObject(payload)) {
    throw new Error('Semantic evaluation payload must be an object.')
  }

  if (typeof payload.callPath !== 'string') {
    throw new Error('Semantic evaluation payload is missing callPath.')
  }

  if (!Array.isArray(payload.evaluatedRubricItems) || !payload.evaluatedRubricItems.every(isValidSemanticFinding)) {
    throw new Error('Semantic evaluation payload has invalid evaluatedRubricItems.')
  }

  if (!Array.isArray(payload.outOfScopeItems) || !payload.outOfScopeItems.every(isValidOutOfScopeItem)) {
    throw new Error('Semantic evaluation payload has invalid outOfScopeItems.')
  }

  if (!Array.isArray(payload.emergentFindings) || !payload.emergentFindings.every(isValidEmergentFinding)) {
    throw new Error('Semantic evaluation payload has invalid emergentFindings.')
  }

  if (typeof payload.overallAssessment !== 'string' || !Array.isArray(payload.topRecommendations)) {
    throw new Error('Semantic evaluation payload is missing required summary fields.')
  }
}

function getEvidenceWeightMap(rubric) {
  return new Map((rubric.rubric || []).map((item) => [item.id, RUBRIC_SEVERITY_WEIGHTS[item.severity] || 1]))
}

function getScoreValue(status) {
  if (status === 'passed') {
    return 1
  }

  if (status === 'failed') {
    return 0
  }

  if (status === 'partially_met') {
    return 0.5
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
  const scorableItems = items.filter((item) => item.status !== 'uncertain')

  if (scorableItems.length === 0) {
    return null
  }

  const weightMap = getEvidenceWeightMap(rubric)
  const weightedTotals = scorableItems.reduce((totals, item) => {
    const weight = getCheckWeight(item, weightMap)

    return {
      score: totals.score + (getScoreValue(item.status) * weight),
      weight: totals.weight + weight,
    }
  }, { score: 0, weight: 0 })

  if (weightedTotals.weight === 0) {
    return null
  }

  return roundScore((weightedTotals.score / weightedTotals.weight) * 100)
}

function getAgentConfigHash(agent) {
  return agent.configHash || computeAgentConfigHash(agent)
}

function hasSemanticEvidence(finding) {
  const turnIndices = Array.isArray(finding.evidence?.turnIndices) ? finding.evidence.turnIndices : []
  const quotes = Array.isArray(finding.evidence?.quotes) ? finding.evidence.quotes : []

  return turnIndices.length > 0 || quotes.length > 0
}

function buildRecommendations(semanticResults) {
  const semanticRecommendations = (semanticResults.topRecommendations || []).map((recommendation) => ({
    description: recommendation.description,
    impactArea: recommendation.impactArea,
    priority: recommendation.priority,
    relatedRubricItems: recommendation.relatedRubricItems,
    title: recommendation.title,
  }))

  return semanticRecommendations
}

function filterValidRubricScopedItems(items, rubric) {
  const validRubricItemIds = new Set((rubric.rubric || []).map((item) => item.id))
  const validItems = []
  let invalidRubricItemCount = 0

  for (const item of items) {
    if (!validRubricItemIds.has(item.rubricItemId)) {
      invalidRubricItemCount += 1
      continue
    }

    validItems.push(item)
  }

  return {
    invalidRubricItemCount,
    validItems,
  }
}

function normalizePassedStatus(status) {
  if (status === 'passed') {
    return true
  }

  if (status === 'uncertain') {
    return null
  }

  return false
}

function normalizeEvaluatedRubricItem(item) {
  return {
    category: item.category,
    evidence: item.evidence,
    evidenceStrength: item.evidenceStrength,
    label: item.label,
    passed: normalizePassedStatus(item.status),
    recommendation: item.recommendation,
    rubricItemId: item.rubricItemId,
    severity: item.severity,
    source: 'llm_semantic',
    status: item.status,
    type: 'rubric_item',
  }
}

function normalizeEmergentFinding(item) {
  return {
    category: item.category,
    evidence: item.evidence,
    evidenceStrength: item.evidenceStrength,
    id: item.id,
    label: item.label,
    passed: normalizePassedStatus(item.status),
    recommendation: item.recommendation,
    severity: item.severity,
    source: 'llm_semantic',
    status: item.status,
    type: 'emergent',
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

async function generateRubric(agentId, options = {}) {
  const { forceRegenerate = false } = options
  const agent = await loadAgent(agentId)
  const currentConfigHash = getAgentConfigHash(agent)

  if (!forceRegenerate && agent.rubric && currentConfigHash && currentConfigHash === agent.rubricConfigHash) {
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

  if (result.data.rubric.length < 10) {
    llmService.logger?.warn(
      { agentId, rubricItemCount: result.data.rubric.length },
      'Rubric generation produced fewer than 10 items'
    )
  }

  const updatedAgent = await prisma.agent.update({
    data: {
      configHash: currentConfigHash,
      rubric: result.data,
      rubricConfigHash: currentConfigHash,
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
  const normalizedRubricItems = filterValidRubricScopedItems(semanticResults.evaluatedRubricItems, rubric)
  const validOutOfScopeItems = filterValidRubricScopedItems(semanticResults.outOfScopeItems, rubric)
  const filteredEvaluatedRubricItems = normalizedRubricItems.validItems.filter(hasSemanticEvidence)
  const filteredEmergentFindings = semanticResults.emergentFindings.filter(hasSemanticEvidence)
  const rejectedEvaluatedItemCount = normalizedRubricItems.validItems.length - filteredEvaluatedRubricItems.length
  const rejectedEmergentFindingCount = semanticResults.emergentFindings.length - filteredEmergentFindings.length

  llmService.logger?.info(
    {
      callLogId,
      invalidOutOfScopeItemCount: validOutOfScopeItems.invalidRubricItemCount,
      invalidRubricItemCount: normalizedRubricItems.invalidRubricItemCount,
      rejectedEmergentFindingCount,
      rejectedEvaluatedItemCount,
    },
    'Applied semantic evidence policy'
  )

  const filteredSemanticResults = {
    ...semanticResults,
    emergentFindings: filteredEmergentFindings,
    evaluatedRubricItems: filteredEvaluatedRubricItems,
    invalidOutOfScopeItemCount: validOutOfScopeItems.invalidRubricItemCount,
    invalidRubricItemCount: normalizedRubricItems.invalidRubricItemCount,
    outOfScopeItems: validOutOfScopeItems.validItems,
    rejectedEmergentFindingCount,
    rejectedEvaluatedItemCount,
  }
  const mergedFindings = [
    ...filteredEvaluatedRubricItems.map(normalizeEvaluatedRubricItem),
    ...filteredEmergentFindings.map(normalizeEmergentFinding),
  ]

  return prisma.callEvaluation.upsert({
    create: {
      agentId: callLog.agentId,
      callPath: filteredSemanticResults.callPath,
      callLogId,
      deterministicResults: {},
      evaluatedAt: new Date(),
      findings: mergedFindings,
      outOfScopeItems: filteredSemanticResults.outOfScopeItems,
      overallScore: calculateOverallScore(filteredEvaluatedRubricItems, rubric),
      recommendations: buildRecommendations(filteredSemanticResults),
      semanticResults: filteredSemanticResults,
    },
    update: {
      callPath: filteredSemanticResults.callPath,
      deterministicResults: {},
      evaluatedAt: new Date(),
      findings: mergedFindings,
      outOfScopeItems: filteredSemanticResults.outOfScopeItems,
      overallScore: calculateOverallScore(filteredEvaluatedRubricItems, rubric),
      recommendations: buildRecommendations(filteredSemanticResults),
      semanticResults: filteredSemanticResults,
    },
    where: {
      callLogId,
    },
  })
}

async function evaluateAllCalls(agentId, options = {}) {
  const { force = false } = options
  await loadAgent(agentId)

  const calls = await prisma.callLog.findMany({
    where: {
      agentId,
      ...(force
        ? {}
        : {
          evaluation: {
            is: null,
          },
        }),
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
