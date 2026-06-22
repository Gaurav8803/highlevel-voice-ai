<template>
  <section class="space-y-6">
    <header class="rounded-lg border border-border bg-white p-6 shadow-card">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-content-primary">
            Voice AI Copilot
          </h1>
          <p class="mt-2 text-sm text-content-secondary">
            Monitor and analyze your Voice AI agents.
          </p>
        </div>

        <div class="flex flex-wrap gap-3">
          <button
            class="inline-flex items-center rounded-md border border-primary bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-primary-light"
            type="button"
            :disabled="syncLoading"
            @click="runSync"
          >
            {{ syncLoading ? 'Syncing...' : 'Sync Data' }}
          </button>
          <button
            class="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            type="button"
            :disabled="syncLoading"
            @click="runFullSync"
          >
            {{ syncLoading ? 'Analyzing...' : 'Sync & Analyze' }}
          </button>
        </div>
      </div>
    </header>

    <div
      v-if="syncError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {{ syncError }}
    </div>

    <div
      v-if="syncResult"
      class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
    >
      Sync complete. Agents: {{ syncAgentCount }}, calls: {{ syncCallCount }}, evaluations:
      {{ syncEvaluationCount }}.
    </div>

    <div
      v-if="loading"
      class="space-y-6"
    >
      <div class="rounded-lg border border-border bg-white p-6 shadow-card">
        <div class="grid gap-4 md:grid-cols-4 md:divide-x md:divide-border">
          <div
            v-for="index in 4"
            :key="`metric-skeleton-${index}`"
            class="space-y-3 px-1 py-2"
          >
            <div class="h-8 w-20 animate-pulse rounded bg-slate-200" />
            <div class="h-4 w-24 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      </div>
      <div class="grid gap-4 lg:grid-cols-2">
        <div
          v-for="index in 2"
          :key="`agent-skeleton-${index}`"
          class="rounded-lg border border-border bg-white p-5 shadow-card"
        >
          <div class="h-5 w-36 animate-pulse rounded bg-slate-200" />
          <div class="mt-3 h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div class="mt-5 h-14 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    </div>

    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 bg-red-50 p-5"
    >
      <p class="text-sm font-medium text-red-700">
        {{ error }}
      </p>
      <button
        class="mt-4 inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        type="button"
        @click="load"
      >
        Retry
      </button>
    </div>

    <EmptyState
      v-else-if="isEmpty"
      action-label="Sync & Analyze"
      description="Bring in your agents and call logs from HighLevel to start surfacing transcript-backed insights."
      title="No dashboard data yet"
      @action="runFullSync"
    />

    <template v-else>
      <section class="rounded-lg border border-border bg-white p-6 shadow-card">
        <div class="grid gap-4 md:grid-cols-4 md:divide-x md:divide-border">
          <MetricCard
            label="Total Agents"
            :value="String(overview.totalAgents || 0)"
          />
          <MetricCard
            label="Calls Analyzed"
            :value="String(overview.totalEvaluated || 0)"
          />
          <MetricCard
            label="Avg Score"
            :tone="scoreTone"
            :value="averageScoreLabel"
          />
          <MetricCard
            label="Issues Found"
            :value="String(overview.issuesFound || 0)"
          />
        </div>
      </section>

      <section
        id="agents"
        class="space-y-4 scroll-mt-24"
      >
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-content-primary">
              Your Agents
            </h2>
            <p class="text-sm text-content-secondary">
              Performance snapshots across your synced Voice AI agents.
            </p>
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <RouterLink
            v-for="agent in overview.agentSummaries"
            :key="agent.agentId"
            :to="{ path: `/agents/${agent.agentId}`, query: getSharedQuery() }"
            class="rounded-lg border border-border bg-white p-5 shadow-card hover:border-primary/40 hover:shadow-md"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <h3 class="truncate text-base font-semibold text-content-primary">
                  {{ agent.agentName }}
                </h3>
                <p class="mt-1 text-sm text-content-secondary">
                  {{ agent.businessName || 'Unknown business' }}
                </p>
              </div>
              <ScoreBadge
                :score="agent.averageScore"
                size="md"
              />
            </div>

            <div class="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-surface-tertiary p-4 text-sm">
              <div>
                <p class="text-content-tertiary">
                  Calls
                </p>
                <p class="mt-1 font-semibold text-content-primary">
                  {{ agent.callCount }}
                </p>
              </div>
              <div>
                <p class="text-content-tertiary">
                  Trend
                </p>
                <p class="mt-1 font-semibold capitalize text-content-primary">
                  {{ agent.trend }}
                </p>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap items-center gap-2">
              <span class="text-xs font-medium uppercase tracking-wide text-content-tertiary">
                Top issue
              </span>
              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-content-secondary">
                {{ agent.topIssue || 'No failed findings yet' }}
              </span>
            </div>
          </RouterLink>
        </div>
      </section>

      <section
        id="calls"
        class="space-y-4 scroll-mt-24"
      >
        <div>
          <h2 class="text-lg font-semibold text-content-primary">
            Recent Evaluations
          </h2>
          <p class="text-sm text-content-secondary">
            Latest scored calls and the top findings that surfaced.
          </p>
        </div>

        <div class="overflow-hidden rounded-lg border border-border bg-white shadow-card">
          <div
            v-if="overview.recentCalls.length === 0"
            class="p-6"
          >
            <EmptyState
              description="Recent calls will appear here once your first synced evaluations finish."
              title="No recent evaluations yet"
            />
          </div>

          <table
            v-else
            class="min-w-full divide-y divide-border"
          >
            <thead class="bg-surface-tertiary">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                  Agent
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                  Call Date
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                  Duration
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                  Score
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                  Top Finding
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr
                v-for="call in overview.recentCalls"
                :key="call.id"
                class="cursor-pointer hover:bg-surface-tertiary"
                @click="openCall(call.id)"
              >
                <td class="px-4 py-4">
                  <div class="font-medium text-content-primary">
                    {{ call.agentName || 'Unknown agent' }}
                  </div>
                  <div class="text-sm text-content-secondary">
                    {{ call.businessName || 'Unknown business' }}
                  </div>
                </td>
                <td class="px-4 py-4 text-sm text-content-secondary">
                  {{ formatDateTime(call.calledAt) }}
                </td>
                <td class="px-4 py-4 text-sm text-content-secondary">
                  {{ formatDuration(call.duration) }}
                </td>
                <td
                  :class="scoreTextClasses(call.overallScore)"
                  class="px-4 py-4 text-sm font-semibold"
                >
                  {{ scoreDisplay(call.overallScore) }}
                </td>
                <td class="px-4 py-4 text-sm text-content-secondary">
                  {{ call.topFinding || 'No failure recorded' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import EmptyState from '../components/dashboard/EmptyState.vue'
import MetricCard from '../components/dashboard/MetricCard.vue'
import ScoreBadge from '../components/dashboard/ScoreBadge.vue'
import { useDashboard } from '../composables/useDashboard.js'
import { formatDateTime, formatDuration, formatScore, getScoreTone } from '../utils/formatters.js'

const route = useRoute()
const router = useRouter()
const {
  data,
  error,
  load,
  loading,
  runFullSync,
  runSync,
  syncError,
  syncLoading,
  syncResult,
} = useDashboard()

const isEmbedded = computed(() => route.query.embedded === 'true' || window.__VOICE_AI_EMBED__?.embedded === true)
const overview = computed(() => data.value || {
  agentSummaries: [],
  averageScore: 0,
  issuesFound: 0,
  recentCalls: [],
  totalAgents: 0,
  totalCalls: 0,
  totalEvaluated: 0,
})
const averageScoreLabel = computed(() => formatScore(overview.value.averageScore))
const isEmpty = computed(() => !overview.value.totalAgents && !overview.value.totalCalls)
const scoreTone = computed(() => getScoreTone(overview.value.averageScore))
const syncAgentCount = computed(() => syncResult.value?.agentSync?.totalSynced || syncResult.value?.agents?.totalSynced || 0)
const syncCallCount = computed(() => syncResult.value?.callSync?.ingestedCount || syncResult.value?.calls?.totalFetched || 0)
const syncEvaluationCount = computed(() => syncResult.value?.evaluationSummary?.evaluatedCount || 0)

function getSharedQuery() {
  return isEmbedded.value
    ? { ...route.query, embedded: 'true' }
    : route.query
}

function scoreDisplay(score) {
  return typeof score === 'number' ? `${Math.round(score)}` : 'N/A'
}

function scoreTextClasses(score) {
  const tone = getScoreTone(score)

  if (tone === 'pass') {
    return 'text-status-pass'
  }

  if (tone === 'warn') {
    return 'text-status-warn'
  }

  if (tone === 'fail') {
    return 'text-status-fail'
  }

  return 'text-content-secondary'
}

function openCall(callId) {
  router.push({
    path: `/calls/${callId}`,
    query: getSharedQuery(),
  })
}

onMounted(load)
</script>
