function stringifyActions(actions) {
  return JSON.stringify(actions || [], null, 2)
}

function buildRubricPrompt(agent) {
  const system = [
    'You are an expert QA architect for voice AI systems.',
    'Analyze the voice AI agent configuration and produce a structured evaluation rubric.',
    'The rubric must define what success looks like for this specific agent across all realistic call paths.',
    'Be comprehensive and aim for 15 to 30 rubric items depending on agent complexity.',
    'Cover every defined action in the agent config, including data extractions, bookings, transfers, SMS, and workflows.',
    'Include script adherence, greeting quality, closing quality, objection handling, caller understanding, and compliance requirements.',
    'Include compliance requirements mentioned in the prompt, such as consent, escalation rules, and time limits.',
    'Generate rubric items that cover all possible branches the agent might take, not just the most common path.',
    'Mark requiresLlm false only for checks that can be verified by presence or absence of data, extracted fields, or triggered actions.',
    'Mark requiresLlm true for checks that require judgment, interpretation, or qualitative assessment.',
    'Output valid JSON only.',
    'Do not mention internal node numbers or implementation details.',
    'Use this exact structure:',
    JSON.stringify({
      agentGoalSummary: 'One paragraph explaining the agent primary purpose and what success looks like',
      primaryGoals: ['goal1', 'goal2'],
      rubric: [
        {
          category: 'data_capture',
          checkType: 'data_extracted',
          description: 'What this rubric item evaluates',
          evidenceRequired: 'transcript',
          failureCondition: 'What constitutes a failure',
          id: 'unique_snake_case_id',
          label: 'Human-readable short title',
          requiresLlm: true,
          severity: 'high',
          successCondition: 'Specific measurable criteria for pass',
        },
      ],
    }, null, 2),
    'Only use categories: data_capture, routing, compliance, communication, goal_completion, objection_handling, booking.',
    'Only use checkType values: data_extracted, appointment_offered, action_triggered, consent_obtained, script_adherence, caller_handling, escalation.',
    'Only use evidenceRequired values: transcript, extracted_data, actions, any.',
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
