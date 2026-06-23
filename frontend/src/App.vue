<script setup>
import { computed, onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { LayoutDashboard, PhoneCall, Users, Waypoints } from '@lucide/vue'

import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/sonner'

const route = useRoute()

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'agents', label: 'Agents', icon: Users },
  { id: 'calls', label: 'Call Logs', icon: PhoneCall },
]

const isEmbedded = computed(() => route.query.embedded === 'true' || window.__VOICE_AI_EMBED__?.embedded === true)
const contentClasses = computed(() => (isEmbedded.value ? 'px-4 py-5 sm:px-5' : 'px-4 py-6 sm:px-6 lg:px-8'))
const shellClasses = computed(() => (isEmbedded.value ? 'bg-transparent' : 'bg-zinc-50'))

function getSharedQuery() {
  return isEmbedded.value ? { ...route.query, embedded: 'true' } : route.query
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

<template>
  <div :class="cn('min-h-screen text-foreground', shellClasses)">
    <div class="mx-auto max-w-[1600px]">
      <header class="border-b bg-card">
        <div class="flex items-center gap-2.5 px-4 pt-4 sm:px-6 lg:px-8">
          <span class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Waypoints class="size-4.5" />
          </span>
          <div class="leading-tight">
            <p class="text-sm font-semibold text-foreground">
              Voice AI Copilot
            </p>
            <p class="text-xs text-muted-foreground">
              Agent observability &amp; coaching
            </p>
          </div>
        </div>

        <nav
          class="mt-3 flex items-center gap-1 px-2 sm:px-4 lg:px-6"
          aria-label="Primary"
        >
          <RouterLink
            v-for="tab in tabs"
            :key="tab.id"
            :to="getTabRoute(tab.id)"
            :class="cn(
              'inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              isTabActive(tab.id)
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )"
          >
            <component
              :is="tab.icon"
              class="size-4"
            />
            {{ tab.label }}
          </RouterLink>
        </nav>
      </header>

      <main :class="contentClasses">
        <RouterView />
      </main>
    </div>
    <Toaster
      position="top-right"
      rich-colors
      close-button
    />
  </div>
</template>
