import { buildRubricPrompt } from '../prompts/rubric-generator.js'
import { buildAgentAnalysisPrompt } from '../prompts/agent-analysis.js'
import { buildEvaluationPrompt } from '../prompts/semantic-evaluator.js'

import { computeAgentAnalysisInputHash, computeAgentConfigHash } from '../utils/hashing.js'
import { prisma } from './prisma.js'
import { llmService } from './llm-service.js'
import { runDeterministicEvaluation } from './deterministic-evaluator.js'

const AGENT_ANALYSIS_MAX_TOKENS = 8000
const AGENT_ANALYSIS_CALL_LIMIT = 40
const AGENT_ANALYSIS_LOW_SCORE_CALL_COUNT = 15
const AGENT_ANALYSIS_MAX_EVIDENCE_SNIPPETS = 24
const AGENT_ANALYSIS_MAX_FINDINGS_PER_CALL = 5
const AGENT_ANALYSIS_MAX_QUOTES_PER_FINDING = 2
const AGENT_ANALYSIS_MAX_RECOMMENDATIONS_PER_CALL = 2
const AGENT_ANALYSIS_MAX_RECURRING_FINDINGS = 15
const AGENT_ANALYSIS_RECENT_CALL_COUNT = 15
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

function ensureArray(value) {
  return Array.isArray(value) ? value : []
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

function isValidTopRecommendation(recommendation) {
  return isObject(recommendation) &&
    typeof recommendation.title === 'string' &&
    typeof recommendation.description === 'string' &&
    typeof recommendation.impactArea === 'string' &&
    typeof recommendation.priority === 'number' &&
    Array.isArray(recommendation.relatedRubricItems) &&
    typeof recommendation.suggestedChange === 'string' &&
    (
      recommendation.promptPatch === null ||
      recommendation.promptPatch === undefined ||
      typeof recommendation.promptPatch === 'string'
    ) &&
    (
      recommendation.actionAdjustment === null ||
      recommendation.actionAdjustment === undefined ||
      typeof recommendation.actionAdjustment === 'string'
    )
}

function isValidAgentRecurringFinding(finding) {
  return isObject(finding) &&
    typeof finding.id === 'string' &&
    typeof finding.label === 'string' &&
    typeof finding.category === 'string' &&
    typeof finding.severity === 'string' &&
    VALID_EVIDENCE_STRENGTHS.has(finding.evidenceStrength) &&
    Array.isArray(finding.affectedCallIds) &&
    finding.affectedCallIds.length > 0 &&
    isObject(finding.evidence) &&
    Array.isArray(finding.evidence.callIds) &&
    finding.evidence.callIds.length > 0 &&
    Array.isArray(finding.evidence.quotes) &&
    finding.evidence.quotes.length > 0 &&
    typeof finding.evidence.reasoning === 'string' &&
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

  if (
    typeof payload.overallAssessment !== 'string' ||
    !Array.isArray(payload.topRecommendations) ||
    !payload.topRecommendations.every(isValidTopRecommendation)
  ) {
    throw new Error('Semantic evaluation payload is missing required summary fields.')
  }
}

function assertValidAgentAnalysisPayload(payload) {
  if (!isObject(payload)) {
    throw new Error('Agent analysis payload must be an object.')
  }

  if (typeof payload.overallAssessment !== 'string') {
    throw new Error('Agent analysis payload is missing overallAssessment.')
  }

  if (!Array.isArray(payload.recurringFindings) || !payload.recurringFindings.every(isValidAgentRecurringFinding)) {
    throw new Error('Agent analysis payload has invalid recurringFindings.')
  }

  if (!Array.isArray(payload.topRecommendations) || !payload.topRecommendations.every(isValidTopRecommendation)) {
    throw new Error('Agent analysis payload has invalid topRecommendations.')
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
    actionAdjustment: recommendation.actionAdjustment ?? null,
    description: recommendation.description,
    impactArea: recommendation.impactArea,
    priority: recommendation.priority,
    promptPatch: recommendation.promptPatch ?? null,
    relatedRubricItems: recommendation.relatedRubricItems,
    suggestedChange: recommendation.suggestedChange,
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

function getSeverityRank(value) {
  return RUBRIC_SEVERITY_WEIGHTS[value] || 0
}

function getEvidenceStrengthRank(value) {
  if (value === 'strong') {
    return 3
  }

  if (value === 'medium') {
    return 2
  }

  if (value === 'weak') {
    return 1
  }

  return 0
}

function getStatusRank(value) {
  if (value === 'failed') {
    return 3
  }

  if (value === 'partially_met') {
    return 2
  }

  if (value === 'uncertain') {
    return 1
  }

  return 0
}

function formatTimestamp(value) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function averageNumbers(values) {
  const numericValues = values.filter((value) => typeof value === 'number' && Number.isFinite(value))

  if (numericValues.length === 0) {
    return null
  }

  return roundScore(numericValues.reduce((total, value) => total + value, 0) / numericValues.length)
}

function getFindingStatus(finding) {
  if (typeof finding?.status === 'string') {
    return finding.status
  }

  if (finding?.passed === true) {
    return 'passed'
  }

  if (finding?.passed === false) {
    return 'failed'
  }

  return 'uncertain'
}

function getFindingQuotes(finding) {
  const quotes = ensureArray(finding?.evidence?.quotes)
    .map((quote) => typeof quote === 'string' ? quote.trim() : '')
    .filter(Boolean)

  return [...new Set(quotes)].slice(0, AGENT_ANALYSIS_MAX_QUOTES_PER_FINDING)
}

function getFindingTurnIndices(finding) {
  return ensureArray(finding?.evidence?.turnIndices)
    .filter((value) => Number.isInteger(value))
    .slice(0, 8)
}

function getFindingPriorityScore(finding) {
  return (getStatusRank(getFindingStatus(finding)) * 100) +
    (getSeverityRank(finding?.severity) * 10) +
    getEvidenceStrengthRank(finding?.evidenceStrength)
}

function buildCompactFinding(finding) {
  return {
    category: finding.category || 'unknown',
    evidenceStrength: finding.evidenceStrength || 'weak',
    label: finding.label || 'Untitled finding',
    quotes: getFindingQuotes(finding),
    recommendation: finding.recommendation ?? null,
    rubricItemId: finding.rubricItemId ?? null,
    severity: finding.severity || 'medium',
    status: getFindingStatus(finding),
    turnIndices: getFindingTurnIndices(finding),
  }
}

function getActionableFindings(findings) {
  return ensureArray(findings)
    .map(buildCompactFinding)
    .filter((finding) => finding.label && finding.status !== 'passed')
    .sort((left, right) => getFindingPriorityScore(right) - getFindingPriorityScore(left))
    .slice(0, AGENT_ANALYSIS_MAX_FINDINGS_PER_CALL)
}

function buildCompactRecommendation(recommendation) {
  return {
    actionAdjustment: recommendation?.actionAdjustment ?? null,
    impactArea: recommendation?.impactArea || 'efficiency',
    promptPatch: recommendation?.promptPatch ?? null,
    relatedRubricItems: ensureArray(recommendation?.relatedRubricItems).slice(0, 5),
    suggestedChange: recommendation?.suggestedChange || recommendation?.title || 'Suggested change',
    title: recommendation?.title || 'Recommendation',
  }
}

function getIssueCount(callLog) {
  return getActionableFindings(callLog?.evaluation?.findings).length
}

function selectCallsForAgentAnalysis(callLogs) {
  const evaluatedCalls = ensureArray(callLogs).filter((callLog) => callLog?.evaluation)

  if (evaluatedCalls.length <= AGENT_ANALYSIS_CALL_LIMIT) {
    return evaluatedCalls
  }

  const selectedCalls = []
  const seen = new Set()

  function appendCalls(calls, limit = Number.POSITIVE_INFINITY) {
    for (const call of calls) {
      if (seen.has(call.id)) {
        continue
      }

      selectedCalls.push(call)
      seen.add(call.id)

      if (selectedCalls.length >= AGENT_ANALYSIS_CALL_LIMIT || selectedCalls.length >= limit) {
        return
      }
    }
  }

  const recentCalls = [...evaluatedCalls].sort((left, right) => {
    return new Date(right.calledAt).getTime() - new Date(left.calledAt).getTime()
  })
  appendCalls(recentCalls, AGENT_ANALYSIS_RECENT_CALL_COUNT)

  const lowestScoreCalls = [...evaluatedCalls].sort((left, right) => {
    const leftScore = typeof left.evaluation?.overallScore === 'number' ? left.evaluation.overallScore : Number.POSITIVE_INFINITY
    const rightScore = typeof right.evaluation?.overallScore === 'number' ? right.evaluation.overallScore : Number.POSITIVE_INFINITY
    return leftScore - rightScore
  })
  appendCalls(lowestScoreCalls, AGENT_ANALYSIS_RECENT_CALL_COUNT + AGENT_ANALYSIS_LOW_SCORE_CALL_COUNT)

  const issueHeavyCalls = [...evaluatedCalls].sort((left, right) => {
    const issueDelta = getIssueCount(right) - getIssueCount(left)
    if (issueDelta !== 0) {
      return issueDelta
    }

    return new Date(right.calledAt).getTime() - new Date(left.calledAt).getTime()
  })
  appendCalls(issueHeavyCalls)

  if (selectedCalls.length < AGENT_ANALYSIS_CALL_LIMIT) {
    appendCalls(recentCalls)
  }

  return selectedCalls
}

function buildCallAnalysisSnapshot(callLog) {
  return {
    callId: callLog.id,
    callPath: callLog.evaluation?.callPath || '',
    calledAt: formatTimestamp(callLog.calledAt),
    duration: callLog.duration,
    keyFindings: getActionableFindings(callLog.evaluation?.findings),
    overallScore: callLog.evaluation?.overallScore ?? null,
    topRecommendations: ensureArray(callLog.evaluation?.recommendations)
      .slice(0, AGENT_ANALYSIS_MAX_RECOMMENDATIONS_PER_CALL)
      .map(buildCompactRecommendation),
  }
}

function buildRecurringFindingSummary(callSummaries) {
  const aggregates = new Map()

  for (const call of callSummaries) {
    for (const finding of call.keyFindings) {
      const key = finding.rubricItemId ? `rubric:${finding.rubricItemId}` : `label:${finding.label.toLowerCase()}`
      const current = aggregates.get(key) || {
        category: finding.category,
        label: finding.label,
        recommendationHints: new Set(),
        rubricItemId: finding.rubricItemId,
        sampleQuotes: [],
        severity: finding.severity,
        statuses: {
          failed: 0,
          partially_met: 0,
          uncertain: 0,
        },
        strongestEvidence: finding.evidenceStrength,
        affectedCallIds: new Set(),
      }

      current.category = current.category || finding.category
      current.label = current.label || finding.label

      if (getSeverityRank(finding.severity) > getSeverityRank(current.severity)) {
        current.severity = finding.severity
      }

      if (getEvidenceStrengthRank(finding.evidenceStrength) > getEvidenceStrengthRank(current.strongestEvidence)) {
        current.strongestEvidence = finding.evidenceStrength
      }

      current.affectedCallIds.add(call.callId)
      current.statuses[finding.status] = (current.statuses[finding.status] || 0) + 1

      if (finding.recommendation) {
        current.recommendationHints.add(finding.recommendation)
      }

      for (const quote of finding.quotes) {
        if (quote && current.sampleQuotes.length < 3 && !current.sampleQuotes.includes(quote)) {
          current.sampleQuotes.push(quote)
        }
      }

      aggregates.set(key, current)
    }
  }

  return [...aggregates.entries()]
    .map(([key, value]) => ({
      affectedCallIds: [...value.affectedCallIds],
      category: value.category,
      findingKey: key,
      label: value.label,
      occurrenceCount: value.affectedCallIds.size,
      recommendationHints: [...value.recommendationHints].slice(0, 2),
      rubricItemId: value.rubricItemId,
      sampleQuotes: value.sampleQuotes,
      severity: value.severity,
      statusBreakdown: value.statuses,
      strongestEvidence: value.strongestEvidence,
    }))
    .sort((left, right) => {
      if (right.occurrenceCount !== left.occurrenceCount) {
        return right.occurrenceCount - left.occurrenceCount
      }

      const severityDelta = getSeverityRank(right.severity) - getSeverityRank(left.severity)
      if (severityDelta !== 0) {
        return severityDelta
      }

      return getEvidenceStrengthRank(right.strongestEvidence) - getEvidenceStrengthRank(left.strongestEvidence)
    })
    .slice(0, AGENT_ANALYSIS_MAX_RECURRING_FINDINGS)
}

function buildSelectedEvidenceSnippets(callSummaries) {
  const snippets = []

  for (const call of callSummaries) {
    for (const finding of call.keyFindings) {
      const quotes = finding.quotes.length ? finding.quotes : [null]

      for (const quote of quotes) {
        snippets.push({
          callId: call.callId,
          callPath: call.callPath,
          calledAt: call.calledAt,
          category: finding.category,
          evidenceStrength: finding.evidenceStrength,
          label: finding.label,
          overallScore: call.overallScore,
          quote,
          rubricItemId: finding.rubricItemId,
          severity: finding.severity,
          status: finding.status,
          turnIndices: finding.turnIndices,
        })
      }
    }
  }

  const deduped = []
  const seen = new Set()

  for (const snippet of snippets.sort((left, right) => {
    const scoreDelta = getFindingPriorityScore(right) - getFindingPriorityScore(left)
    if (scoreDelta !== 0) {
      return scoreDelta
    }

    const leftScore = typeof left.overallScore === 'number' ? left.overallScore : Number.POSITIVE_INFINITY
    const rightScore = typeof right.overallScore === 'number' ? right.overallScore : Number.POSITIVE_INFINITY
    return leftScore - rightScore
  })) {
    const key = `${snippet.callId}:${snippet.label}:${snippet.quote || ''}`
    if (seen.has(key)) {
      continue
    }

    deduped.push(snippet)
    seen.add(key)

    if (deduped.length >= AGENT_ANALYSIS_MAX_EVIDENCE_SNIPPETS) {
      break
    }
  }

  return deduped
}

function buildAgentAnalysisInput(callLogs) {
  const selectedCalls = selectCallsForAgentAnalysis(callLogs)
  const evaluatedCalls = ensureArray(callLogs).filter((callLog) => callLog?.evaluation)
  const callSummaries = selectedCalls.map(buildCallAnalysisSnapshot)

  return {
    callSetSummary: {
      averageScore: averageNumbers(evaluatedCalls.map((callLog) => callLog.evaluation?.overallScore)),
      selectedCallCount: callSummaries.length,
      selectionStrategy: 'recent_calls + lowest_scores + issue_heavy_calls, capped at 40 evaluated calls',
      totalEvaluatedCalls: evaluatedCalls.length,
    },
    callSummaries,
    evidenceSnippets: buildSelectedEvidenceSnippets(callSummaries),
    recurringFindings: buildRecurringFindingSummary(callSummaries),
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

async function loadAgentAnalysisContext(agentId) {
  const agent = await prisma.agent.findUnique({
    select: {
      actions: true,
      agentAnalysis: true,
      agentAnalysisGeneratedAt: true,
      agentAnalysisInputHash: true,
      agentName: true,
      agentPrompt: true,
      businessName: true,
      callLogs: {
        orderBy: {
          calledAt: 'asc',
        },
        select: {
          calledAt: true,
          duration: true,
          id: true,
          evaluation: {
            select: {
              callPath: true,
              findings: true,
              overallScore: true,
              recommendations: true,
            },
          },
        },
      },
      id: true,
    },
    where: {
      id: agentId,
    },
  })

  if (!agent) {
    throw createAppError('NOT_FOUND', 'Agent not found.')
  }

  return agent
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

async function runAgentAnalysis(agent, analysisInput) {
  const prompt = buildAgentAnalysisPrompt(agent, analysisInput)
  let result

  try {
    result = await llmService.completeJson({
      maxTokens: AGENT_ANALYSIS_MAX_TOKENS,
      system: prompt.system,
      user: prompt.user,
    })
  } catch (error) {
    llmService.logger?.error(
      { agentId: agent.id, error: error.message },
      'Agent analysis request failed'
    )
    throw createAppError('LLM_REQUEST_FAILED', `Agent analysis failed: ${error.message}`)
  }

  try {
    assertValidAgentAnalysisPayload(result.data)
  } catch (error) {
    llmService.logger?.error(
      { agentId: agent.id, rawResponse: result.rawText },
      'Agent analysis returned invalid JSON payload'
    )
    throw createAppError('INVALID_LLM_JSON', `Agent analysis returned invalid JSON: ${error.message}`)
  }

  return result.data
}

async function generateAgentAnalysis(agentId, options = {}) {
  const { forceRegenerate = false } = options
  const agent = await loadAgentAnalysisContext(agentId)
  const analysisInput = buildAgentAnalysisInput(agent.callLogs)

  if (analysisInput.callSetSummary.totalEvaluatedCalls === 0) {
    return {
      analysis: null,
      generatedAt: agent.agentAnalysisGeneratedAt ?? null,
    }
  }

  const inputHash = computeAgentAnalysisInputHash({
    agent,
    analysisInput,
  })

  if (!forceRegenerate && agent.agentAnalysis && inputHash === agent.agentAnalysisInputHash) {
    return {
      analysis: agent.agentAnalysis,
      generatedAt: agent.agentAnalysisGeneratedAt ?? null,
    }
  }

  const analysis = await runAgentAnalysis(agent, analysisInput)
  const updatedAgent = await prisma.agent.update({
    data: {
      agentAnalysis: analysis,
      agentAnalysisGeneratedAt: new Date(),
      agentAnalysisInputHash: inputHash,
    },
    select: {
      agentAnalysis: true,
      agentAnalysisGeneratedAt: true,
    },
    where: {
      id: agentId,
    },
  })

  return {
    analysis: updatedAgent.agentAnalysis,
    generatedAt: updatedAgent.agentAnalysisGeneratedAt,
  }
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

export { evaluateAllCalls, evaluateCall, generateAgentAnalysis, generateRubric }
