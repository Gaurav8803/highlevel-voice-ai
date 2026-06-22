export default async function agentsRoutes(fastify) {
  fastify.get('/agents', async function listAgentsHandler() {
    return {
      data: [],
      meta: {
        page: 1,
        total: 0,
      },
    }
  })
}
