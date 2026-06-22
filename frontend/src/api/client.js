const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api'

async function apiRequest(path, options = {}) {
  const { headers, ...restOptions } = options
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...restOptions,
  })

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`)
  }

  return response.json()
}

export { API_BASE, apiRequest }
