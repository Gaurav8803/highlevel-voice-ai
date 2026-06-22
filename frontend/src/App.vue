<template>
  <div
    :class="shellClasses"
    class="min-h-screen text-content-primary"
  >
    <div class="mx-auto max-w-[1600px]">
      <div :class="frameClasses">
        <nav
          class="border-b border-border bg-white"
          aria-label="Voice AI dashboard navigation"
        >
          <div class="flex items-center gap-6 px-6">
            <RouterLink
              v-for="tab in tabs"
              :key="tab.id"
              :class="[
                isTabActive(tab.id)
                  ? 'border-primary text-primary'
                  : 'border-transparent text-content-secondary hover:text-content-primary',
                'border-b-2 py-4 text-sm font-medium',
              ]"
              :to="getTabRoute(tab.id)"
            >
              {{ tab.label }}
            </RouterLink>
          </div>
        </nav>

        <main :class="contentClasses">
          <RouterView />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()

const tabs = [
  {
    id: 'overview',
    label: 'Overview',
  },
  {
    id: 'agents',
    label: 'Agents',
  },
  {
    id: 'calls',
    label: 'Call Logs',
  },
]

const isEmbedded = computed(() => route.query.embedded === 'true' || window.__VOICE_AI_EMBED__?.embedded === true)
const contentClasses = computed(() => (isEmbedded.value ? 'px-4 py-4 sm:px-5' : 'px-6 py-6'))
const frameClasses = computed(() => (
  isEmbedded.value
    ? 'overflow-hidden bg-transparent'
    : 'overflow-hidden rounded-xl border border-border bg-white shadow-card'
))
const shellClasses = computed(() => (isEmbedded.value ? 'bg-transparent' : 'bg-surface-secondary'))

function getSharedQuery() {
  return isEmbedded.value
    ? { ...route.query, embedded: 'true' }
    : route.query
}

function getTabRoute(tabId) {
  if (tabId === 'agents') {
    return { path: '/', hash: '#agents', query: getSharedQuery() }
  }

  if (tabId === 'calls') {
    return { path: '/', hash: '#calls', query: getSharedQuery() }
  }

  return { name: 'dashboard', query: getSharedQuery() }
}

function isTabActive(tabId) {
  if (route.name === 'agent-detail') {
    return tabId === 'agents'
  }

  if (route.name === 'call-detail') {
    return tabId === 'calls'
  }

  if (route.hash === '#agents') {
    return tabId === 'agents'
  }

  if (route.hash === '#calls') {
    return tabId === 'calls'
  }

  return tabId === 'overview'
}

function syncEmbeddedMode() {
  document.documentElement.classList.toggle('embedded-mode', isEmbedded.value)
  document.body.classList.toggle('embedded-mode', isEmbedded.value)
}

watch(isEmbedded, syncEmbeddedMode)
onMounted(syncEmbeddedMode)
</script>
