import process from 'node:process'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MAX_JSON_RETRIES = 2
const DEFAULT_MAX_RATE_LIMIT_RETRIES = 3
const DEFAULT_MODEL = 'claude-sonnet-4-6'

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function extractTextContent(contentBlocks) {
  if (!Array.isArray(contentBlocks)) {
    return ''
  }

  return contentBlocks
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

function isRateLimitResponse(response) {
  return response.status === 429 || response.status === 529
}

function getRetryDelay(attempt) {
  return 500 * (2 ** attempt)
}

function createServiceError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function buildJsonRetryUserPrompt({ userPrompt, attempt, parseError, stopReason }) {
  const retryInstructions = [
    `The previous response was not valid JSON on retry attempt ${attempt}.`,
    'Return only valid JSON with no markdown fences or extra commentary.',
    `Parsing failed with: ${parseError}.`,
  ]

  if (stopReason === 'max_tokens') {
    retryInstructions.push(
      'Your previous response was cut off by the token limit.',
      'Return a much shorter answer with fewer items and more compact text fields.'
    )
  }

  return [
    userPrompt,
    '',
    ...retryInstructions,
  ].join('\n')
}

function sanitizeJsonText(rawText) {
  return rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function parseJsonText(rawText) {
  return JSON.parse(sanitizeJsonText(rawText))
}

class LlmService {
  constructor({ apiKey, model = DEFAULT_MODEL, logger = null }) {
    this.apiKey = apiKey
    this.model = model
    this.logger = logger
  }

  setLogger(logger) {
    this.logger = logger
    return this
  }

  async complete({ system, user, maxTokens }) {
    let attempt = 0

    while (true) {
      const startedAt = Date.now()
      const response = await fetch(ANTHROPIC_API_URL, {
        body: JSON.stringify({
          max_tokens: maxTokens,
          messages: [
            {
              content: user,
              role: 'user',
            },
          ],
          model: this.model,
          system,
        }),
        headers: {
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
        },
        method: 'POST',
      })

      const latencyMs = Date.now() - startedAt
      const bodyText = await response.text()

      if (isRateLimitResponse(response) && attempt < DEFAULT_MAX_RATE_LIMIT_RETRIES) {
        const retryDelay = getRetryDelay(attempt)
        this.logger?.warn(
          { attempt: attempt + 1, latencyMs, retryDelay },
          'Anthropic rate limit encountered, retrying request'
        )
        await delay(retryDelay)
        attempt += 1
        continue
      }

      let payload

      try {
        payload = JSON.parse(bodyText)
      } catch {
        throw createServiceError('LLM_API_ERROR', `Anthropic API returned non-JSON response: ${bodyText}`)
      }

      if (!response.ok) {
        throw createServiceError(
          'LLM_API_ERROR',
          `Anthropic API request failed with status ${response.status}: ${JSON.stringify(payload)}`
        )
      }

      const content = extractTextContent(payload.content)

      this.logger?.info(
        {
          inputTokens: payload.usage?.input_tokens ?? null,
          latencyMs,
          model: payload.model ?? this.model,
          outputTokens: payload.usage?.output_tokens ?? null,
          stopReason: payload.stop_reason ?? null,
        },
        'Anthropic completion completed'
      )

      return {
        content,
        latencyMs,
        rawResponse: payload,
        usage: payload.usage ?? {},
      }
    }
  }

  async completeJson({ system, user, maxTokens }) {
    let attempt = 0
    let currentUserPrompt = user

    while (attempt <= DEFAULT_MAX_JSON_RETRIES) {
      const result = await this.complete({
        maxTokens,
        system,
        user: currentUserPrompt,
      })

      try {
        return {
          data: parseJsonText(result.content),
          rawText: result.content,
          rawResponse: result.rawResponse,
          usage: result.usage,
        }
      } catch (error) {
        this.logger?.error(
          {
            attempt: attempt + 1,
            parseError: error.message,
            rawResponse: result.content,
            stopReason: result.rawResponse?.stop_reason ?? null,
          },
          'Anthropic JSON parse failed'
        )

        if (attempt === DEFAULT_MAX_JSON_RETRIES) {
          throw createServiceError(
            'INVALID_LLM_JSON',
            `Anthropic returned invalid JSON after ${attempt + 1} attempts: ${error.message}`
          )
        }

        currentUserPrompt = buildJsonRetryUserPrompt({
          attempt: attempt + 1,
          parseError: error.message,
          stopReason: result.rawResponse?.stop_reason ?? null,
          userPrompt: user,
        })
        attempt += 1
      }
    }

    throw createServiceError('INVALID_LLM_JSON', 'Anthropic JSON completion failed unexpectedly.')
  }
}

function createLlmService(config) {
  return new LlmService(config)
}

const llmService = createLlmService({
  apiKey: process.env.ANTHROPIC_API_KEY,
  logger: null,
  model: DEFAULT_MODEL,
})

export { LlmService, createLlmService, llmService }
