function stringifyActions(actions) {
  return JSON.stringify(actions || [], null, 2)
}

function buildRubricPrompt(agent) {
  const system = [
    'You are an expert QA architect for voice AI systems.',
    'Analyze the voice AI agent configuration and produce a structured evaluation rubric.',
    'Cover every call path explicitly described or strongly implied by the agent prompt/actions. Do not invent call paths that are not supported by the config.',
    'Generate as many rubric items as needed, usually 8-25. Prefer fewer high-signal checks over broad generic checks.',
    'Cover every defined action in the agent config, including data extractions, bookings, transfers, SMS, and workflows.',
    'Include script adherence, greeting quality, closing quality, objection handling, caller understanding, and compliance requirements.',
    'Include compliance requirements mentioned in the prompt, such as consent, escalation rules, and time limits.',
    'Generate rubric items that cover all possible branches the agent might take, not just the most common path.',
    'Each rubric item must be atomic and evaluate exactly one behavior. Do not combine multiple behaviors into one item.',
    'Every rubric item must include explicit applicability guidance, a trigger condition, and an out-of-scope condition.',
    'Use evaluationMode "structured_evidence" for checks primarily verified through extracted data, actions, or clear structured artifacts.',
    'Use evaluationMode "semantic" for checks that require transcript interpretation, conversational quality judgment, or nuanced assessment.',
    'Output valid JSON only.',
    'Do not mention internal node numbers or implementation details.',
    'Use this exact structure:',
    JSON.stringify({
      agentGoalSummary: 'One paragraph explaining the agent primary purpose and what success looks like',
      primaryGoals: ['goal1', 'goal2'],
      rubric: [
        {
          applicability: 'When this item should be evaluated',
          category: 'data_capture',
          checkType: 'data_extracted',
          description: 'What this rubric item evaluates',
          evaluationMode: 'structured_evidence',
          evidenceRequired: ['transcript', 'extracted_data'],
          failureCondition: 'What constitutes a failure',
          id: 'unique_snake_case_id',
          label: 'Human-readable short title',
          outOfScopeCondition: 'When this should not be evaluated',
          recommendationHint: 'What kind of fix should be suggested if this fails',
          severity: 'high',
          successCondition: 'Specific measurable criteria for pass',
          triggerCondition: 'What makes this relevant in a transcript',
        },
      ],
    }, null, 2),
    'Only use categories: data_capture, routing, compliance, communication, goal_completion, objection_handling, booking.',
    'Only use checkType values: data_extracted, appointment_offered, action_triggered, consent_obtained, script_adherence, caller_handling, escalation.',
    'Only use evidenceRequired values from this set: transcript, extracted_data, actions, any.',
    'evidenceRequired must always be an array with one or more values.',
    'Only use evaluationMode values: semantic, structured_evidence.',
    'Only use severity values: critical, high, medium, low.',
  ].join('\n')

  const user = [
    `Agent name: ${agent.agentName}`,
    `Business name: ${agent.businessName}`,
    `Welcome message: ${agent.rawConfig?.welcomeMessage || ''}`,
    'Actions:',
    stringifyActions(agent.actions),
    'Full agent prompt:',
    agent.agentPrompt,
  ].join('\n\n')

  return { system, user }
}

export { buildRubricPrompt }
