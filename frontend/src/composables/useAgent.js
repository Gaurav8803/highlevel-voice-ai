import { toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'

import { apiRequest, getAgentDetail, triggerAgentAnalysis } from '@/api/client.js'

export function useAgent(agentId) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => getAgentDetail(toValue(agentId)),
    select: (response) => response.data,
    enabled: () => Boolean(toValue(agentId)),
  })

  const rubricMutation = useMutation({
    mutationFn: () => apiRequest(`/agents/${toValue(agentId)}/rubric/regenerate`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agent', toValue(agentId)] })
      toast.success('Rubric refreshed', { description: 'Re-generated the evaluation rubric for this agent.' })
    },
    onError: (error) => toast.error('Rubric refresh failed', { description: error.message }),
  })

  const analysisMutation = useMutation({
    mutationFn: () => triggerAgentAnalysis(toValue(agentId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agent', toValue(agentId)] })
      toast.success('Analysis refreshed', { description: 'Updated the agent-wide analysis from the latest evaluated calls.' })
    },
    onError: (error) => toast.error('Analysis refresh failed', { description: error.message }),
  })

  return {
    agent: query.data,
    error: query.error,
    isError: query.isError,
    isLoading: query.isLoading,
    refreshAnalysis: () => analysisMutation.mutate(),
    analysisPending: analysisMutation.isPending,
    regenerateRubric: () => rubricMutation.mutate(),
    rubricPending: rubricMutation.isPending,
  }
}
