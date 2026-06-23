import { toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'

import { getCallDetail, triggerEvaluation } from '@/api/client.js'

export function useCall(callId) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['call', callId],
    queryFn: () => getCallDetail(toValue(callId)),
    select: (response) => response.data,
    enabled: () => Boolean(toValue(callId)),
  })

  const evaluateMutation = useMutation({
    mutationFn: () => triggerEvaluation(toValue(callId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['call', toValue(callId)] })
      toast.success('Evaluation complete', { description: 'This call was re-analyzed against the rubric.' })
    },
    onError: (error) => toast.error('Evaluation failed', { description: error.message }),
  })

  return {
    call: query.data,
    error: query.error,
    evaluate: () => evaluateMutation.mutate(),
    evaluating: evaluateMutation.isPending,
    isError: query.isError,
    isLoading: query.isLoading,
  }
}
