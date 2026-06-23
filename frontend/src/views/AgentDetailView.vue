<template>
  <section class="space-y-6">
    <RouterLink
      class="inline-flex items-center text-sm font-medium text-primary hover:text-primary-hover"
      :to="{ path: '/', hash: '#agents', query: getSharedQuery() }"
    >
      ← All Agents
    </RouterLink>

    <div
      v-if="loading"
      class="space-y-4"
    >
      <div class="rounded-lg border border-border bg-white p-6 shadow-card">
        <div class="h-6 w-48 animate-pulse rounded bg-slate-200" />
        <div class="mt-3 h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div class="mt-5 h-16 animate-pulse rounded bg-slate-100" />
      </div>
      <div class="rounded-lg border border-border bg-white p-6 shadow-card">
        <div class="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div class="mt-4 h-40 animate-pulse rounded bg-slate-100" />
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
        @click="reload"
      >
        Retry
      </button>
    </div>

    <EmptyState
      v-else-if="!agentDetail"
      description="This agent record is not available yet."
      title="Agent not found"
    />

    <template v-else>
      <header class="rounded-lg border border-border bg-white p-6 shadow-card">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <p class="text-sm font-medium text-content-secondary">
              {{ agentDetail.agent.businessName || 'Unknown business' }}
            </p>
            <h1 class="mt-2 text-2xl font-semibold tracking-tight text-content-primary">
              {{ agentDetail.agent.agentName }}
            </h1>
            <p class="mt-3 max-w-2xl text-sm leading-6 text-content-secondary">
              {{ rubricSummary }}
            </p>
          </div>

          <div class="flex flex-col items-start gap-3 lg:items-end">
            <ScoreBadge
              :score="agentDetail.metrics.averageScore"
              size="lg"
            />
            <button
              class="inline-flex items-center rounded-md border border-primary bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-primary-light"
              type="button"
              :disabled="rubricLoading"
              @click="generateAgentRubric"
            >
              {{ rubricLoading ? 'Generating...' : 'Refresh Rubric' }}
            </button>
          </div>
        </div>
      </header>

      <div
        v-if="rubricError"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ rubricError }}
      </div>

      <section class="rounded-lg border border-border bg-white shadow-card">
        <div class="border-b border-border px-6">
          <div class="flex items-center gap-6">
            <button
              v-for="tab in tabs"
              :key="tab"
              :class="[
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-content-secondary hover:text-content-primary',
                'border-b-2 py-4 text-sm font-medium capitalize',
              ]"
              type="button"
              @click="activeTab = tab"
            >
              {{ tab }}
            </button>
          </div>
        </div>

        <div class="p-6">
          <div
            v-if="activeTab === 'metrics'"
            class="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
          >
            <article class="rounded-lg border border-border bg-surface-tertiary p-5">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-base font-semibold text-content-primary">
                    Score Trend
                  </h2>
                  <p class="text-sm text-content-secondary">
                    Average score across evaluated calls over time.
                  </p>
                </div>
                <span class="text-sm font-medium text-content-secondary">
                  {{ agentDetail.metrics.totalCalls }} calls
                </span>
              </div>

              <div
                v-if="scoreTrendPoints"
                class="mt-5 rounded-lg border border-border bg-white p-4"
              >
                <svg
                  class="h-40 w-full"
                  viewBox="0 0 320 160"
                  preserveAspectRatio="none"
                >
                  <line
                    v-for="marker in [20, 50, 80, 110, 140]"
                    :key="marker"
                    x1="0"
                    :y1="marker"
                    x2="320"
                    :y2="marker"
                    stroke="#E2E8F0"
                    stroke-dasharray="4 4"
                  />
                  <polyline
                    fill="none"
                    points="10,140 310,140"
                    stroke="#CBD5E1"
                    stroke-linecap="round"
                    stroke-width="2"
                  />
                  <polyline
                    fill="none"
                    :points="scoreTrendPoints"
                    stroke="#4F46E5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="3"
                  />
                </svg>
                <div class="mt-3 flex flex-wrap justify-between gap-2 text-xs text-content-tertiary">
                  <span
                    v-for="point in scoreTrend"
                    :key="`${point.date}-${point.score}`"
                  >
                    {{ formatShortDate(point.date) }} · {{ Math.round(point.score) }}
                  </span>
                </div>
              </div>

              <EmptyState
                v-else
                description="This agent needs evaluated calls before trend data can be plotted."
                title="No score trend yet"
              />
            </article>

            <div class="space-y-5">
              <article class="rounded-lg border border-border bg-surface-tertiary p-5">
                <h2 class="text-base font-semibold text-content-primary">
                  Action Success Rates
                </h2>
                <div
                  v-if="agentDetail.metrics.actionSuccessRates.length"
                  class="mt-4 space-y-4"
                >
                  <div
                    v-for="action in agentDetail.metrics.actionSuccessRates"
                    :key="action.actionName"
                  >
                    <div class="mb-1 flex items-center justify-between gap-3">
                      <span class="text-sm font-medium text-content-primary">{{ action.actionName }}</span>
                      <span class="text-xs text-content-secondary">
                        {{ action.succeeded }}/{{ action.attempted }} succeeded
                      </span>
                    </div>
                    <div class="h-2 rounded-full bg-slate-200">
                      <div
                        class="h-2 rounded-full bg-primary"
                        :style="{ width: `${action.rate}%` }"
                      />
                    </div>
                  </div>
                </div>
                <p
                  v-else
                  class="mt-4 text-sm text-content-secondary"
                >
                  No action execution data is available for this agent yet.
                </p>
              </article>

              <article class="grid gap-4 md:grid-cols-2">
                <div class="rounded-lg border border-border bg-surface-tertiary p-5">
                  <p class="text-sm font-medium text-content-secondary">
                    Extraction Completeness
                  </p>
                  <p class="mt-2 text-3xl font-semibold text-content-primary">
                    {{ extractionLabel }}
                  </p>
                  <div class="mt-4 h-2 rounded-full bg-slate-200">
                    <div
                      class="h-2 rounded-full bg-status-pass"
                      :style="{ width: extractionBarWidth }"
                    />
                  </div>
                </div>

                <div class="rounded-lg border border-border bg-surface-tertiary p-5">
                  <p class="text-sm font-medium text-content-secondary">
                    Avg Response Latency
                  </p>
                  <p class="mt-2 text-3xl font-semibold text-content-primary">
                    {{ responseLatencyLabel }}
                  </p>
                  <p class="mt-3 text-sm text-content-secondary">
                    Average seconds between a user turn finishing and the agent replying.
                  </p>
                </div>
              </article>
            </div>
          </div>

          <div
            v-else-if="activeTab === 'findings'"
            class="space-y-4"
          >
            <div
              v-if="agentDetail.metrics.findingFrequency.length"
              class="space-y-4"
            >
              <article
                v-for="finding in agentDetail.metrics.findingFrequency"
                :key="`${finding.category}-${finding.finding}`"
                class="rounded-lg border border-border bg-surface-tertiary p-5"
              >
                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <h2 class="text-base font-semibold text-content-primary">
                        {{ finding.finding }}
                      </h2>
                      <CategoryBadge :category="finding.category" />
                    </div>
                    <p class="mt-3 text-sm text-content-secondary">
                      {{ sampleEvidenceText(finding) }}
                    </p>
                  </div>
                  <span class="inline-flex items-center rounded-full bg-white px-3 py-1 text-sm font-medium text-content-secondary">
                    {{ finding.count }}x
                  </span>
                </div>
              </article>
            </div>
            <EmptyState
              v-else
              description="Finding frequencies will appear once failed checks and semantic findings are stored."
              title="No findings frequency data yet"
            />
          </div>

          <div
            v-else-if="activeTab === 'recommendations'"
            class="space-y-4"
          >
            <div
              v-if="sortedRecommendations.length"
              class="grid gap-4"
            >
              <article
                v-for="recommendation in sortedRecommendations"
                :key="recommendation.title"
                class="rounded-lg border border-border bg-surface-tertiary p-5"
              >
                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="rounded-full bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary">
                        Priority {{ recommendation.priority || 'N/A' }}
                      </span>
                      <span
                        v-if="recommendation.impactArea"
                        class="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-content-secondary"
                      >
                        {{ recommendation.impactArea }}
                      </span>
                    </div>
                    <h2 class="mt-3 text-base font-semibold text-content-primary">
                      {{ recommendation.title }}
                    </h2>
                    <p class="mt-2 text-sm leading-6 text-content-secondary">
                      {{ recommendation.description || 'No additional recommendation detail available.' }}
                    </p>
                  </div>
                  <span class="inline-flex items-center rounded-full bg-white px-3 py-1 text-sm font-medium text-content-secondary">
                    {{ recommendation.frequency }}x
                  </span>
                </div>
                <div
                  v-if="recommendation.relatedRubricItems?.length"
                  class="mt-4 flex flex-wrap gap-2"
                >
                  <span
                    v-for="relatedRubricItem in recommendation.relatedRubricItems"
                    :key="relatedRubricItem"
                    class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-content-secondary"
                  >
                    {{ relatedRubricItem }}
                  </span>
                </div>
              </article>
            </div>
            <EmptyState
              v-else
              description="Recommendations will populate once this agent has semantic evaluations."
              title="No recommendations available yet"
            />
          </div>

          <div
            v-else
            class="space-y-6"
          >
            <article class="rounded-lg border border-border bg-surface-tertiary p-5">
              <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div class="max-w-3xl">
                  <h2 class="text-base font-semibold text-content-primary">
                    Rubric Goal Summary
                  </h2>
                  <p class="mt-3 text-sm leading-6 text-content-secondary">
                    {{ rubric?.agentGoalSummary || 'Rubric generation has not completed for this agent yet.' }}
                  </p>
                </div>
                <div class="rounded-lg bg-white px-4 py-3 text-sm text-content-secondary">
                  <span class="font-semibold text-content-primary">{{ rubricItems.length }}</span> rubric items
                </div>
              </div>

              <div
                v-if="rubricPrimaryGoals.length"
                class="mt-5 flex flex-wrap gap-2"
              >
                <span
                  v-for="goal in rubricPrimaryGoals"
                  :key="goal"
                  class="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-content-secondary"
                >
                  {{ goal }}
                </span>
              </div>
            </article>

            <div
              v-if="rubricItems.length"
              class="grid gap-4"
            >
              <RubricItemCard
                v-for="item in rubricItems"
                :key="item.id"
                :item="item"
              />
            </div>
            <EmptyState
              v-else
              description="Generate or refresh the rubric to render the agent evaluation contract here."
              title="No rubric items available yet"
            />
          </div>
        </div>
      </section>

      <section class="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        <div class="border-b border-border px-6 py-4">
          <h2 class="text-base font-semibold text-content-primary">
            Calls
          </h2>
        </div>
        <table class="min-w-full divide-y divide-border">
          <thead class="bg-surface-tertiary">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                Call Date
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                Duration
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                Score
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="call in agentDetail.calls"
              :key="call.id"
              class="cursor-pointer hover:bg-surface-tertiary"
              @click="openCall(call.id)"
            >
              <td class="px-4 py-4 text-sm text-content-secondary">
                {{ formatDateTime(call.calledAt) }}
              </td>
              <td class="px-4 py-4 text-sm text-content-secondary">
                {{ formatDuration(call.duration) }}
              </td>
              <td class="px-4 py-4">
                <ScoreBadge
                  :score="call.overallScore"
                  size="sm"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import CategoryBadge from '../components/dashboard/CategoryBadge.vue'
import EmptyState from '../components/dashboard/EmptyState.vue'
import RubricItemCard from '../components/dashboard/RubricItemCard.vue'
import ScoreBadge from '../components/dashboard/ScoreBadge.vue'
import { useAgent } from '../composables/useAgent.js'
import { formatDateTime, formatDuration, formatShortDate } from '../utils/formatters.js'

const route = useRoute()
const router = useRouter()
const { data, error, generateRubric, load, loading, rubricError, rubricLoading } = useAgent()
const activeTab = ref('metrics')
const tabs = ['metrics', 'findings', 'recommendations', 'rubric']
const isEmbedded = computed(() => route.query.embedded === 'true' || window.__VOICE_AI_EMBED__?.embedded === true)

const agentDetail = computed(() => data.value)
const scoreTrend = computed(() => agentDetail.value?.metrics?.scoreOverTime || [])
const scoreTrendPoints = computed(() => {
  const points = scoreTrend.value

  if (points.length < 2) {
    return ''
  }

  return points
    .map((point, index) => {
      const x = 10 + ((300 / (points.length - 1)) * index)
      const y = 140 - ((Math.max(0, Math.min(100, point.score)) / 100) * 120)
      return `${x},${y}`
    })
    .join(' ')
})
const extractionLabel = computed(() => `${Math.round(agentDetail.value?.metrics?.extractionCompleteness || 0)}%`)
const extractionBarWidth = computed(() => `${Math.max(0, Math.min(100, agentDetail.value?.metrics?.extractionCompleteness || 0))}%`)
const responseLatencyLabel = computed(() => `${(agentDetail.value?.metrics?.averageResponseLatency || 0).toFixed(1)}s`)
const rubricSummary = computed(() => {
  const rubric = agentDetail.value?.agent?.rubric

  if (!rubric?.agentGoalSummary) {
    return 'Rubric generation has not completed for this agent yet.'
  }

  return `${rubric.agentGoalSummary} Primary goals: ${(rubric.primaryGoals || []).join(', ')}.`
})
const rubric = computed(() => agentDetail.value?.agent?.rubric || null)
const rubricItems = computed(() => Array.isArray(rubric.value?.rubric) ? rubric.value.rubric : [])
const rubricPrimaryGoals = computed(() => Array.isArray(rubric.value?.primaryGoals) ? rubric.value.primaryGoals : [])
const sortedRecommendations = computed(() => {
  const recommendations = agentDetail.value?.topRecommendations || []
  return [...recommendations].sort((left, right) => {
    const leftPriority = left.priority ?? Number.POSITIVE_INFINITY
    const rightPriority = right.priority ?? Number.POSITIVE_INFINITY

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }

    return (right.frequency || 0) - (left.frequency || 0)
  })
})

function sampleEvidenceText(finding) {
  if (finding.sampleEvidence?.quotes?.length) {
    return finding.sampleEvidence.quotes.join(' | ')
  }

  if (finding.sampleEvidence?.reasoning) {
    return finding.sampleEvidence.reasoning
  }

  if (finding.sampleEvidence?.turnIndices?.length) {
    return `Referenced turns: ${finding.sampleEvidence.turnIndices.join(', ')}`
  }

  return 'No sample evidence available.'
}

function getSharedQuery() {
  return isEmbedded.value
    ? { ...route.query, embedded: 'true' }
    : route.query
}

function openCall(callId) {
  router.push({
    path: `/calls/${callId}`,
    query: getSharedQuery(),
  })
}

function reload() {
  load(route.params.id)
}

function generateAgentRubric() {
  generateRubric(route.params.id)
}

watch(() => route.params.id, reload, { immediate: true })
</script>
