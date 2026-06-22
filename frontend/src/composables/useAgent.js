import { ref } from 'vue'

import { apiRequest, getAgentDetail } from '../api/client.js'

export function useAgent() {
  const data = ref(null)
  const error = ref('')
  const loading = ref(false)
  const rubricLoading = ref(false)
  const rubricError = ref('')

  async function load(agentId) {
    loading.value = true
    error.value = ''

    try {
      const response = await getAgentDetail(agentId)
      data.value = response.data
    } catch (loadError) {
      error.value = loadError.message
    } finally {
      loading.value = false
    }
  }

  async function generateRubric(agentId) {
    rubricLoading.value = true
    rubricError.value = ''

    try {
      await apiRequest(`/agents/${agentId}/generate-rubric`, {
        method: 'POST',
      })
      await load(agentId)
    } catch (requestError) {
      rubricError.value = requestError.message
    } finally {
      rubricLoading.value = false
    }
  }

  return {
    data,
    error,
    generateRubric,
    load,
    loading,
    rubricError,
    rubricLoading,
  }
}
