function formatTranscript(turns) {
  return turns
    .map((turn) => {
      const startTime = typeof turn.startTime === 'number' ? turn.startTime.toFixed(3) : 'n/a'
      const endTime = typeof turn.endTime === 'number' ? turn.endTime.toFixed(3) : 'n/a'
      return `[${turn.index}] ${turn.role} (${startTime}-${endTime}): ${turn.content || ''}`
    })
    .join('\n')
}

function buildEvaluationPrompt(agent, rubric, normalizedTranscript, deterministicResults) {
  const system = [
    'You are an expert evaluator for voice AI conversations.',
    'You will receive the full agent rubric, transcript, and deterministic evaluation context.',
    'Not every rubric item applies to every call.',
    'Only evaluate rubric items where the conversation path created an opportunity for that item to be relevant.',
    'Use each rubric item\'s applicability, triggerCondition, and outOfScopeCondition to decide whether it should be evaluated or marked out-of-scope.',
    'If a rubric item is about handling objections but no objection was raised, mark it as out-of-scope, not as passed.',
    'A billing-related rubric item should be out-of-scope for a new lead call with no billing discussion.',
    'Evaluate only the relevant rubric items for this specific call.',
    'Return out-of-scope items separately with a clear reason.',
    'Include emergentFindings only for issues or missed opportunities not covered by the rubric.',
    'Every evaluatedRubricItem and emergentFinding must include transcript evidence with turnIndices or quotes.',
    'If you cannot provide evidence, do not include the finding.',
    'For rubric items with evaluationMode "structured_evidence", pay close attention to extracted data, action logs, and explicit transcript evidence rather than subjective interpretation.',
    'For rubric-backed and out-of-scope items, rubricItemId must exactly match one rubric item id from the provided rubric JSON.',
    'Do not invent, rename, or paraphrase rubric item ids.',
    'Output valid JSON only.',
    'Keep the output concise but comprehensive.',
    'Return no more than 6 topRecommendations.',
    'Keep quotes short and each reasoning field to 1-3 sentences.',
    'Use this exact structure:',
    JSON.stringify({
      callPath: 'Brief description of the path this call took',
      evaluatedRubricItems: [
        {
          category: 'communication',
          evidenceStrength: 'strong',
          evidence: {
            quotes: ['exact transcript quote'],
            reasoning: 'why this is a pass or fail',
            turnIndices: [1, 2, 3],
          },
          label: 'human-readable finding title',
          recommendation: 'specific actionable fix if failed',
          rubricItemId: 'rubric_item_id',
          severity: 'high',
          status: 'failed',
        },
      ],
      outOfScopeItems: [
        {
          label: 'Billing inquiry properly routed',
          reason: 'Caller was a new lead and no billing discussion occurred',
          rubricItemId: 'billing_handled',
        },
      ],
      emergentFindings: [
        {
          category: 'communication',
          evidenceStrength: 'medium',
          evidence: {
            quotes: ['exact transcript quote'],
            reasoning: 'why this is a problem',
            turnIndices: [25, 26, 27],
          },
          id: 'emergent_1',
          label: 'Finding not covered by rubric',
          recommendation: 'specific actionable fix',
          severity: 'medium',
          status: 'failed',
        },
      ],
      overallAssessment: '2-3 sentence summary',
      topRecommendations: [
        {
          description: 'detailed recommendation',
          impactArea: 'conversion',
          priority: 1,
          relatedRubricItems: ['rubric_item_id_1', 'rubric_item_id_2'],
          title: 'short title',
        },
      ],
    }, null, 2),
    'Quotes must be exact snippets copied from the transcript.',
    'Allowed status values: passed, failed, partially_met, uncertain.',
    'Allowed evidenceStrength values: strong, medium, weak.',
    'Use uncertain only when the transcript is genuinely ambiguous.',
    'Not every rubric item will apply to every call, even if it exists in the master rubric.',
  ].join('\n')

  const user = [
    `Agent name: ${agent.agentName}`,
    `Business name: ${agent.businessName}`,
    'Rubric JSON:',
    JSON.stringify(rubric, null, 2),
    'Deterministic check results:',
    JSON.stringify(deterministicResults, null, 2),
    'Normalized transcript:',
    formatTranscript(normalizedTranscript),
  ].join('\n\n')

  return { system, user }
}

export { buildEvaluationPrompt }
