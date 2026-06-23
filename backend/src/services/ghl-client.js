import process from 'node:process'

const DEFAULT_API_BASE = 'https://services.leadconnectorhq.com'
const DEFAULT_API_VERSION = '2021-07-28'
const MAX_CALL_LOG_PAGE_SIZE = 50

function appendQueryParams(url, params) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    url.searchParams.set(key, String(value))
  }
}

function parseJsonBody(bodyText) {
  if (!bodyText) {
    return null
  }

  try {
    return JSON.parse(bodyText)
  } catch {
    return bodyText
  }
}

function formatErrorBody(body) {
  if (!body) {
    return 'No response body returned.'
  }

  if (typeof body === 'string') {
    return body
  }

  return JSON.stringify(body)
}

function extractArray(payload, keys) {
  if (Array.isArray(payload)) {
    return payload
  }

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key]
    }

    if (Array.isArray(payload?.data?.[key])) {
      return payload.data[key]
    }
  }

  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  throw new Error('Unexpected GHL response shape.')
}

function extractObject(payload, keys) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    for (const key of keys) {
      if (payload[key] && typeof payload[key] === 'object') {
        return payload[key]
      }

      if (payload.data?.[key] && typeof payload.data[key] === 'object') {
        return payload.data[key]
      }
    }
  }

  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload
  }

  throw new Error('Unexpected GHL response shape.')
}

function getPaginationTotalPages(payload) {
  const candidates = [
    payload?.meta?.totalPages,
    payload?.meta?.total_pages,
    payload?.pagination?.totalPages,
    payload?.pagination?.total_pages,
    payload?.data?.meta?.totalPages,
    payload?.data?.meta?.total_pages,
  ]

  for (const value of candidates) {
    const parsedValue = Number.parseInt(value, 10)

    if (Number.isInteger(parsedValue) && parsedValue > 0) {
      return parsedValue
    }
  }

  return null
}

function assertRequiredConfig(client) {
  if (!client.apiBase || !client.token || !client.locationId || !client.apiVersion) {
    throw new Error('GHL client is missing one or more required configuration values.')
  }
}

class GhlClient {
  constructor({ apiBase, token, locationId, apiVersion, logger }) {
    this.apiBase = apiBase
    this.token = token
    this.locationId = locationId
    this.apiVersion = apiVersion
    this.logger = logger
  }

  setLogger(logger) {
    this.logger = logger
    return this
  }

  _buildUrl(path, params = {}) {
    const url = new URL(path, this.apiBase)
    appendQueryParams(url, { locationId: this.locationId, ...params })
    return url
  }

  async _request(method, path, params = {}) {
    assertRequiredConfig(this)

    const url = this._buildUrl(path, params)

    this.logger?.info({ method, path }, 'GHL API request')

    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.token}`,
        Version: this.apiVersion,
      },
    })

    const bodyText = await response.text()
    const body = parseJsonBody(bodyText)

    if (!response.ok) {
      throw new Error(
        `GHL API ${method} ${path} failed with status ${response.status}: ${formatErrorBody(body)}`
      )
    }

    if (typeof body === 'string') {
      throw new Error(`GHL API ${method} ${path} returned a non-JSON response body.`)
    }

    return body
  }

  async listAgents() {
    const payload = await this._request('GET', '/voice-ai/agents')
    return extractArray(payload, ['agents'])
  }

  async getAgent(agentId) {
    const payload = await this._request('GET', `/voice-ai/agents/${agentId}`)
    return extractObject(payload, ['agent'])
  }

  async listCallLogs({ agentId, page, pageSize, startDate, endDate } = {}) {
    const normalizedPageSize = pageSize
      ? Math.min(pageSize, MAX_CALL_LOG_PAGE_SIZE)
      : undefined

    if (page) {
      const payload = await this._request('GET', '/voice-ai/dashboard/call-logs', {
        agentId,
        endDate,
        page,
        pageSize: normalizedPageSize,
        startDate,
      })

      return extractArray(payload, ['callLogs', 'calls'])
    }

    const effectivePageSize = normalizedPageSize || MAX_CALL_LOG_PAGE_SIZE
    const allCallLogs = []
    let currentPage = 1
    let totalPages = null

    while (true) {
      const payload = await this._request('GET', '/voice-ai/dashboard/call-logs', {
        agentId,
        endDate,
        page: currentPage,
        pageSize: effectivePageSize,
        startDate,
      })
      const pageCallLogs = extractArray(payload, ['callLogs', 'calls'])

      allCallLogs.push(...pageCallLogs)

      if (totalPages === null) {
        totalPages = getPaginationTotalPages(payload)
      }

      if (pageCallLogs.length === 0) {
        break
      }

      if (totalPages !== null && currentPage >= totalPages) {
        break
      }

      if (pageCallLogs.length < effectivePageSize) {
        break
      }

      currentPage += 1
    }

    return allCallLogs
  }

  async getCallLog(callId) {
    const payload = await this._request('GET', `/voice-ai/dashboard/call-logs/${callId}`)
    return extractObject(payload, ['callLog', 'call'])
  }
}

function createGhlClient(config) {
  return new GhlClient(config)
}

const ghlClient = createGhlClient({
  apiBase: process.env.GHL_API_BASE || DEFAULT_API_BASE,
  apiVersion: process.env.GHL_API_VERSION || DEFAULT_API_VERSION,
  locationId: process.env.GHL_LOCATION_ID,
  logger: null,
  token: process.env.GHL_PIT_TOKEN,
})

export { GhlClient, createGhlClient, ghlClient }
