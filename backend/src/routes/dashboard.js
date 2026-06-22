export default async function dashboardRoutes(fastify) {
  fastify.get('/dashboard', async function dashboardHandler() {
    return {
      data: {
        agents: 0,
        calls: 0,
        evaluations: 0,
      },
    }
  })
}
