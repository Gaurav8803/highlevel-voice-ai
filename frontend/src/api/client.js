const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api')

function buildErrorMessage(status, payload) {
  if (payload && typeof payload.error === 'string') {
    return payload.error
  }

  return `API request failed with status ${status}`
}

async function parseJson(response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error('The API returned invalid JSON.')
  }
}

async function apiRequest(path, options = {}) {
  const { body, headers, method = 'GET' } = options
  const requestHeaders = {
    'Accept': 'application/json',
    ...headers,
  }

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${API_BASE}${path}`, {
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: requestHeaders,
    method,
  })

  const payload = await parseJson(response)

  if (!response.ok) {
    const error = new Error(buildErrorMessage(response.status, payload))
    error.payload = payload
    error.status = response.status
    throw error
  }

  return payload
}

function getDashboardOverview() {
  return apiRequest('/dashboard/overview')
}

function getAgentDetail(id) {
  return apiRequest(`/dashboard/agent/${id}`)
}

function getCallDetail(id) {
  return apiRequest(`/dashboard/call/${id}`)
}

async function triggerSync() {
  const [agents, calls] = await Promise.all([
    apiRequest('/agents/sync', { method: 'POST' }),
    apiRequest('/calls/sync', { method: 'POST' }),
  ])

  return {
    data: {
      agents: agents.data,
      calls: calls.data,
    },
  }
}

function triggerEvaluation(callId) {
  return apiRequest(`/analysis/evaluate/${callId}`, {
    method: 'POST',
  })
}

function triggerFullSync() {
  return apiRequest('/dashboard/sync-and-evaluate', {
    method: 'POST',
  })
}

export {
  API_BASE,
  apiRequest,
  getAgentDetail,
  getCallDetail,
  getDashboardOverview,
  triggerEvaluation,
  triggerFullSync,
  triggerSync,
}
