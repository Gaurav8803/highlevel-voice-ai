function stringifyActions(actions) {
  return JSON.stringify(actions || [], null, 2)
}

function buildRubricPrompt(agent) {
  const system = [
    'You are an expert QA architect for voice AI systems.',
    'Analyze the voice AI agent configuration and produce a structured evaluation rubric.',
    'The rubric defines what success looks like for this specific agent.',
    'Output valid JSON only.',
    'Keep the output compact enough to fit within 2000 tokens.',
    'Return exactly 6 rubricItems total and prioritize only the highest-value evaluation dimensions.',
    'Keep agentSummary under 18 words.',
    'Return 3 to 5 primaryGoals total.',
    'Keep each description, successCriteria, and failureCriteria to one concise sentence under 18 words.',
    'Do not mention internal node numbers, implementation details, or repeated background context.',
    'Use this exact structure:',
    JSON.stringify({
      agentSummary: 'one-line description of agent purpose',
      primaryGoals: ['goal1', 'goal2'],
      rubricItems: [
        {
          category: 'goal_completion',
          description: 'what to evaluate',
          failureCriteria: 'what constitutes a failure',
          id: 'unique_snake_case_id',
          requiresSemanticEval: true,
          successCriteria: 'specific measurable criteria for pass',
          weight: 3,
        },
      ],
    }, null, 2),
    'Each rubric item weight must be an integer from 1 to 5.',
    'Only use categories: goal_completion, communication, compliance, objection_handling, data_capture, routing.',
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
