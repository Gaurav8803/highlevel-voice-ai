import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'

import { getDashboardOverview, triggerFullSync, triggerSync } from '@/api/client.js'

const OVERVIEW_KEY = ['dashboard-overview']

export function useDashboard() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: getDashboardOverview,
    select: (response) => response.data,
  })

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY })
  }

  const syncMutation = useMutation({
    mutationFn: triggerSync,
    onSuccess: async (response) => {
      await invalidate()
      const agents = response.data?.agents?.totalSynced ?? 0
      const calls = response.data?.calls?.ingestedCount ?? response.data?.calls?.totalFetched ?? 0
      toast.success('Sync complete', { description: `${agents} agents and ${calls} calls refreshed.` })
    },
    onError: (error) => toast.error('Sync failed', { description: error.message }),
  })

  const fullSyncMutation = useMutation({
    mutationFn: triggerFullSync,
    onSuccess: async (response) => {
      await invalidate()
      const evaluated = response.data?.evaluationSummary?.evaluatedCount ?? 0
      toast.success('Sync & analysis complete', { description: `${evaluated} calls evaluated.` })
    },
    onError: (error) => toast.error('Sync & analyze failed', { description: error.message }),
  })

  const syncing = computed(() => syncMutation.isPending.value || fullSyncMutation.isPending.value)

  return {
    error: query.error,
    isError: query.isError,
    isLoading: query.isLoading,
    overview: query.data,
    refetch: query.refetch,
    runFullSync: () => fullSyncMutation.mutate(),
    runSync: () => syncMutation.mutate(),
    syncing,
  }
}
