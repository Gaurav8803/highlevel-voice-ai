import { createHash } from 'node:crypto'

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue)
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = sortValue(value[key])
        return result
      }, {})
  }

  return value ?? null
}

function getWelcomeMessage(agent) {
  return agent.welcomeMessage ?? agent.rawConfig?.welcomeMessage ?? ''
}

function computeAgentConfigHash(agent) {
  const payload = {
    actions: sortValue(agent.actions ?? []),
    agentPrompt: agent.agentPrompt ?? agent.prompt ?? '',
    welcomeMessage: getWelcomeMessage(agent),
  }

  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
}

export { computeAgentConfigHash }
