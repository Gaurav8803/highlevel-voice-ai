export default async function analysisRoutes(fastify) {
  fastify.get('/analysis', async function analysisHandler() {
    return {
      data: null,
    }
  })
}
