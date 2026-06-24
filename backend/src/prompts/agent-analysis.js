function buildAgentAnalysisPrompt(agent, analysisInput) {
  const system = [
    'You are an expert observability analyst for voice AI systems.',
    'You are performing an agent-wide synthesis pass across many calls.',
    'Do not re-evaluate raw transcripts. The call-level findings below already came from rubric-grounded call analysis.',
    'You will receive the current agent prompt, compact call summaries, recurring call-level findings, and selected evidence snippets.',
    'Use the current prompt as implementation context when you recommend prompt-level changes.',
    'Base your findings on repeated patterns or high-severity failures, not on isolated trivia.',
    'Generate immediate recommendations for prompt, script, or agent configuration adjustments.',
    'If the fix is a prompt change, provide a ready-to-paste promptPatch.',
    'If the fix is an action or configuration change, describe the exact actionAdjustment.',
    'Every recurring finding must include evidence from at least one quote and at least one affected call id.',
    'Only make claims that are supported by the provided compact call analysis outputs and evidence snippets.',
    'Output valid JSON only.',
    'Use this exact structure:',
    JSON.stringify({
      overallAssessment: '2-4 sentence summary of the agent performance across the analyzed call set',
      recurringFindings: [
        {
          affectedCallIds: ['call_id_1', 'call_id_2'],
          category: 'communication',
          evidence: {
            callIds: ['call_id_1'],
            quotes: ['exact quote from one of the selected evidence snippets'],
            reasoning: 'why this is a recurring or meaningful issue',
          },
          evidenceStrength: 'strong',
          id: 'unique_snake_case_id',
          label: 'Human-readable recurring finding title',
          recommendation: 'specific fix for this finding',
          severity: 'high',
        },
      ],
      topRecommendations: [
        {
          actionAdjustment: 'Exact workflow, action, or configuration change to make',
          description: 'Detailed description of why this recommendation matters across the call set',
          impactArea: 'conversion',
          priority: 1,
          promptPatch: 'Ready-to-paste prompt patch text',
          relatedRubricItems: ['rubric_item_id_1', 'rubric_item_id_2'],
          suggestedChange: 'Short summary of the change to make',
          title: 'Short recommendation title',
        },
      ],
    }, null, 2),
    'Allowed evidenceStrength values: strong, medium, weak.',
    'Allowed impactArea values: conversion, satisfaction, compliance, efficiency, goal_completion, data_capture, communication.',
    'Keep topRecommendations to 3-6 high-signal items.',
    'Prefer changes that are actionable and directly implementable by an operator.',
  ].join('\n')

  const user = [
    `Agent name: ${agent.agentName}`,
    `Business name: ${agent.businessName}`,
    'Current agent prompt:',
    agent.agentPrompt || '',
    'Call set summary:',
    JSON.stringify(analysisInput.callSetSummary, null, 2),
    'Recurring call-level findings:',
    JSON.stringify(analysisInput.recurringFindings, null, 2),
    'Selected evidence snippets:',
    JSON.stringify(analysisInput.evidenceSnippets, null, 2),
    'Compact call summaries:',
    JSON.stringify(analysisInput.callSummaries, null, 2),
  ].join('\n\n')

  return { system, user }
}

export { buildAgentAnalysisPrompt }
