import { ref } from 'vue'

import { getDashboardOverview, triggerFullSync, triggerSync } from '../api/client.js'

export function useDashboard() {
  const data = ref(null)
  const error = ref('')
  const loading = ref(false)
  const syncError = ref('')
  const syncLoading = ref(false)
  const syncResult = ref(null)

  async function load() {
    loading.value = true
    error.value = ''

    try {
      const response = await getDashboardOverview()
      data.value = response.data
    } catch (loadError) {
      error.value = loadError.message
    } finally {
      loading.value = false
    }
  }

  async function runSync() {
    syncLoading.value = true
    syncError.value = ''

    try {
      syncResult.value = (await triggerSync()).data
      await load()
    } catch (requestError) {
      syncError.value = requestError.message
    } finally {
      syncLoading.value = false
    }
  }

  async function runFullSync() {
    syncLoading.value = true
    syncError.value = ''

    try {
      syncResult.value = (await triggerFullSync()).data
      await load()
    } catch (requestError) {
      syncError.value = requestError.message
    } finally {
      syncLoading.value = false
    }
  }

  return {
    data,
    error,
    load,
    loading,
    runFullSync,
    runSync,
    syncError,
    syncLoading,
    syncResult,
  }
}
