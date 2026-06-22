import { ref } from 'vue'

import { getCallDetail, triggerEvaluation } from '../api/client.js'

export function useCall() {
  const data = ref(null)
  const error = ref('')
  const evaluationError = ref('')
  const evaluationLoading = ref(false)
  const loading = ref(false)

  async function load(callId) {
    loading.value = true
    error.value = ''

    try {
      const response = await getCallDetail(callId)
      data.value = response.data
    } catch (loadError) {
      error.value = loadError.message
    } finally {
      loading.value = false
    }
  }

  async function evaluate(callId) {
    evaluationLoading.value = true
    evaluationError.value = ''

    try {
      await triggerEvaluation(callId)
      await load(callId)
    } catch (requestError) {
      evaluationError.value = requestError.message
    } finally {
      evaluationLoading.value = false
    }
  }

  return {
    data,
    error,
    evaluate,
    evaluationError,
    evaluationLoading,
    load,
    loading,
  }
}
