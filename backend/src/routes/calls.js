export default async function callsRoutes(fastify) {
  fastify.get('/calls', async function listCallsHandler() {
    return {
      data: [],
      meta: {
        page: 1,
        total: 0,
      },
    }
  })
}
