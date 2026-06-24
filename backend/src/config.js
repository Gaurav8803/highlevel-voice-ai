import { fileURLToPath } from 'node:url'

const envFilePath = fileURLToPath(new URL('../../.env', import.meta.url))

const envSchema = {
  type: 'object',
  required: ['DATABASE_URL', 'GHL_PIT_TOKEN', 'GHL_LOCATION_ID', 'ANTHROPIC_API_KEY'],
  properties: {
    PORT: {
      type: 'integer',
      default: 3001,
    },
    DATABASE_URL: {
      type: 'string',
    },
    GHL_API_BASE: {
      type: 'string',
      default: 'https://services.leadconnectorhq.com',
    },
    GHL_PIT_TOKEN: {
      type: 'string',
    },
    GHL_LOCATION_ID: {
      type: 'string',
    },
    GHL_CLIENT_ID: {
      type: 'string',
    },
    GHL_CLIENT_SECRET: {
      type: 'string',
    },
    GHL_REDIRECT_URI: {
      type: 'string',
    },
    GHL_API_VERSION: {
      type: 'string',
      default: '2021-07-28',
    },
    ANTHROPIC_API_KEY: {
      type: 'string',
    },
  },
}

const envOptions = {
  confKey: 'config',
  data: process.env,
  dotenv: {
    path: envFilePath,
  },
  schema: envSchema,
}

function getConfig(fastify) {
  return fastify.config
}

export { envOptions, envSchema, getConfig }
