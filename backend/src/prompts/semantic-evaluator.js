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
  const allowedRubricItemIds = Array.isArray(rubric.rubricItems)
    ? rubric.rubricItems
      .filter((item) => item.requiresSemanticEval)
      .map((item) => item.id)
    : []

  const system = [
    'You are an expert evaluator for voice AI conversations.',
    'Evaluate the transcript against the rubric items marked requiresSemanticEval: true.',
    'Also identify any issues not in the rubric but clearly evident in the transcript.',
    'Every finding must include transcript evidence.',
    'For rubric-backed findings, rubricItemId must exactly match one rubric item id from the provided rubric JSON.',
    'Do not invent, rename, or paraphrase rubric item ids.',
    'Output valid JSON only.',
    'Keep the output concise and avoid repetition.',
    'Return no more than 8 findings and no more than 5 topRecommendations.',
    'Keep each quote short and each reasoning field to 1-2 sentences.',
    'Use this exact structure:',
    JSON.stringify({
      findings: [
        {
          category: 'communication',
          confidence: 0.84,
          evidence: {
            quotes: ['exact transcript quote'],
            reasoning: 'why this is a pass or fail',
            turnIndices: [1, 2, 3],
          },
          label: 'human-readable finding title',
          passed: true,
          recommendation: 'specific actionable fix if failed',
          rubricItemId: 'id_or_null',
          source: 'llm_semantic',
        },
      ],
      overallAssessment: '2-3 sentence summary',
      topRecommendations: [
        {
          description: 'detailed recommendation',
          impactArea: 'conversion',
          priority: 3,
          relatedFindings: ['finding label'],
          title: 'short title',
        },
      ],
    }, null, 2),
    'Quotes must be exact snippets copied from the transcript.',
    'If a finding is uncertain, set passed to null and explain why in reasoning.',
  ].join('\n')

  const user = [
    `Agent name: ${agent.agentName}`,
    `Business name: ${agent.businessName}`,
    'Allowed semantic rubric item IDs:',
    JSON.stringify(allowedRubricItemIds, null, 2),
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
