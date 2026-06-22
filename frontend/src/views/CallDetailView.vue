<template>
  <section class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <RouterLink
        class="inline-flex items-center text-sm font-medium text-primary hover:text-primary-hover"
        :to="{ path: '/', hash: '#calls', query: getSharedQuery() }"
      >
        ← Back to Call Logs
      </RouterLink>

      <button
        class="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        type="button"
        :disabled="evaluationLoading"
        @click="runEvaluation"
      >
        {{ evaluationLoading ? 'Evaluating...' : evaluationButtonLabel }}
      </button>
    </div>

    <div
      v-if="evaluationError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {{ evaluationError }}
    </div>

    <div
      v-if="loading"
      class="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
    >
      <div class="rounded-lg border border-border bg-white p-6 shadow-card">
        <div class="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div class="mt-4 space-y-3">
          <div
            v-for="index in 4"
            :key="`transcript-skeleton-${index}`"
            class="h-20 animate-pulse rounded bg-slate-100"
          />
        </div>
      </div>
      <div class="rounded-lg border border-border bg-white p-6 shadow-card">
        <div class="h-6 w-36 animate-pulse rounded bg-slate-200" />
        <div class="mt-4 space-y-3">
          <div
            v-for="index in 5"
            :key="`finding-skeleton-${index}`"
            class="h-16 animate-pulse rounded bg-slate-100"
          />
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
        @click="reload"
      >
        Retry
      </button>
    </div>

    <EmptyState
      v-else-if="!callDetail"
      description="This call record is not available yet."
      title="Call not found"
    />

    <template v-else>
      <header class="rounded-lg border border-border bg-white p-6 shadow-card">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <p class="text-sm font-medium text-content-secondary">
              {{ callDetail.agent.businessName || 'Unknown business' }}
            </p>
            <h1 class="mt-2 text-2xl font-semibold tracking-tight text-content-primary">
              {{ callDetail.agent.agentName || 'Voice AI call' }}
            </h1>
            <div class="mt-3 flex flex-wrap gap-3 text-sm text-content-secondary">
              <span>{{ formatDateTime(callDetail.call.calledAt) }}</span>
              <span>{{ formatDuration(callDetail.call.duration) }}</span>
              <span>{{ transcriptCountLabel }}</span>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <ScoreBadge
              :score="callDetail.evaluation?.overallScore"
              size="lg"
            />
          </div>
        </div>

        <div
          v-if="callDetail.agent.rubricSummary"
          class="mt-5 rounded-lg bg-surface-tertiary p-4 text-sm text-content-secondary"
        >
          <p class="font-medium text-content-primary">
            {{ callDetail.agent.rubricSummary.agentSummary }}
          </p>
          <p class="mt-2">
            Goals: {{ callDetail.agent.rubricSummary.primaryGoals.join(', ') || 'No goals listed.' }}
          </p>
        </div>
      </header>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section class="rounded-lg border border-border bg-white p-6 shadow-card">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-content-primary">
                Transcript Viewer
              </h2>
              <p class="text-sm text-content-secondary">
                Click any finding to jump to its referenced turns.
              </p>
            </div>
          </div>

          <div
            v-if="turns.length"
            class="mt-5 max-h-[780px] space-y-3 overflow-y-auto pr-1"
          >
            <div
              v-for="turn in turns"
              :key="turn.index"
              :ref="(element) => setTurnRef(turn.index, element)"
            >
              <TranscriptBubble
                :highlighted="activeTurnIndices.includes(turn.index)"
                :tone="selectedTone"
                :turn="turn"
              />
            </div>
          </div>
          <EmptyState
            v-else
            description="This call does not have normalized transcript turns yet."
            title="No transcript available"
          />
        </section>

        <section class="rounded-lg border border-border bg-white p-6 shadow-card">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-lg font-semibold text-content-primary">
                Evaluation Panel
              </h2>
              <p class="text-sm text-content-secondary">
                Deterministic checks and transcript-backed AI analysis.
              </p>
            </div>
            <div class="text-right">
              <p class="text-xs uppercase tracking-wide text-content-tertiary">
                Overall Score
              </p>
              <p :class="overallScoreClass" class="mt-1 text-3xl font-semibold">
                {{ overallScoreLabel }}
              </p>
            </div>
          </div>

          <EmptyState
            v-if="!callDetail.evaluation"
            action-label="Run Evaluation"
            description="This call has not been evaluated yet."
            title="No evaluation stored"
            @action="runEvaluation"
          />

          <template v-else>
            <div class="mt-6 space-y-6">
              <section>
                <div class="mb-3 flex items-center justify-between">
                  <h3 class="text-sm font-semibold uppercase tracking-wide text-content-tertiary">
                    Deterministic Checks
                  </h3>
                  <span class="text-xs text-content-secondary">
                    {{ deterministicChecks.length }} checks
                  </span>
                </div>
                <div class="space-y-3">
                  <FindingItem
                    v-for="check in deterministicChecks"
                    :key="check.checkId"
                    :finding="check"
                    :selected="selectedFindingKey === findingKey(check)"
                    @select="selectFinding"
                  />
                </div>
              </section>

              <section>
                <div class="mb-3 flex items-center justify-between">
                  <h3 class="text-sm font-semibold uppercase tracking-wide text-content-tertiary">
                    AI Analysis
                  </h3>
                  <span class="text-xs text-content-secondary">
                    {{ semanticFindings.length }} findings
                  </span>
                </div>
                <div class="space-y-3">
                  <FindingItem
                    v-for="finding in semanticFindings"
                    :key="findingKey(finding)"
                    :finding="finding"
                    :selected="selectedFindingKey === findingKey(finding)"
                    show-confidence
                    @select="selectFinding"
                  />
                </div>
              </section>

              <section>
                <div class="mb-3 flex items-center justify-between">
                  <h3 class="text-sm font-semibold uppercase tracking-wide text-content-tertiary">
                    Recommendations
                  </h3>
                  <span class="text-xs text-content-secondary">
                    {{ recommendations.length }} items
                  </span>
                </div>
                <div class="space-y-3">
                  <article
                    v-for="recommendation in recommendations"
                    :key="recommendation.title || recommendation.label || recommendation.recommendation"
                    class="rounded-lg border border-border bg-surface-tertiary p-4"
                  >
                    <div class="flex flex-wrap items-center gap-2">
                      <span
                        v-if="recommendation.priority"
                        class="rounded-full bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary"
                      >
                        Priority {{ recommendation.priority }}
                      </span>
                      <span
                        v-if="recommendation.impactArea"
                        class="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-content-secondary"
                      >
                        {{ recommendation.impactArea }}
                      </span>
                    </div>
                    <h4 class="mt-3 text-sm font-semibold text-content-primary">
                      {{ recommendation.title || recommendation.label || 'Recommendation' }}
                    </h4>
                    <p class="mt-2 text-sm leading-6 text-content-secondary">
                      {{ recommendation.description || recommendation.recommendation || 'No recommendation detail is available.' }}
                    </p>
                  </article>
                </div>
              </section>
            </div>
          </template>
        </section>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import EmptyState from '../components/dashboard/EmptyState.vue'
import FindingItem from '../components/dashboard/FindingItem.vue'
import ScoreBadge from '../components/dashboard/ScoreBadge.vue'
import TranscriptBubble from '../components/dashboard/TranscriptBubble.vue'
import { useCall } from '../composables/useCall.js'
import { formatDateTime, formatDuration, formatScore, getScoreTone } from '../utils/formatters.js'

const route = useRoute()
const { data, error, evaluate, evaluationError, evaluationLoading, load, loading } = useCall()
const turnRefs = new Map()
const selectedFinding = ref(null)
const isEmbedded = computed(() => route.query.embedded === 'true' || window.__VOICE_AI_EMBED__?.embedded === true)

const callDetail = computed(() => data.value)
const deterministicChecks = computed(() => callDetail.value?.evaluation?.deterministicResults?.checks || [])
const semanticFindings = computed(() => callDetail.value?.evaluation?.semanticResults?.findings || [])
const recommendations = computed(() => callDetail.value?.evaluation?.recommendations || [])
const turns = computed(() => callDetail.value?.call?.transcriptTurns || [])
const activeTurnIndices = computed(() => selectedFinding.value?.evidence?.turnIndices || [])
const selectedFindingKey = computed(() => (selectedFinding.value ? findingKey(selectedFinding.value) : ''))
const selectedTone = computed(() => {
  if (!selectedFinding.value) {
    return 'warn'
  }

  if (selectedFinding.value.passed === true) {
    return 'pass'
  }

  if (selectedFinding.value.passed === false) {
    return 'fail'
  }

  return 'warn'
})
const overallScoreLabel = computed(() => formatScore(callDetail.value?.evaluation?.overallScore))
const overallScoreClass = computed(() => {
  const tone = getScoreTone(callDetail.value?.evaluation?.overallScore)

  if (tone === 'pass') {
    return 'text-status-pass'
  }

  if (tone === 'warn') {
    return 'text-status-warn'
  }

  if (tone === 'fail') {
    return 'text-status-fail'
  }

  return 'text-content-primary'
})
const transcriptCountLabel = computed(() => `${turns.value.length} transcript turns`)
const evaluationButtonLabel = computed(() => (callDetail.value?.evaluation ? 'Re-run Evaluation' : 'Run Evaluation'))

function getSharedQuery() {
  return isEmbedded.value
    ? { ...route.query, embedded: 'true' }
    : route.query
}

function findingKey(finding) {
  return finding.checkId || finding.rubricItemId || finding.label
}

function setTurnRef(index, element) {
  if (element) {
    turnRefs.set(index, element)
    return
  }

  turnRefs.delete(index)
}

function selectFinding(finding) {
  selectedFinding.value = finding
}

function reload() {
  load(route.params.id)
}

async function runEvaluation() {
  await evaluate(route.params.id)
}

watch(() => route.params.id, () => {
  selectedFinding.value = null
  reload()
}, { immediate: true })
watch(activeTurnIndices, async (indices) => {
  if (!indices.length) {
    return
  }

  await nextTick()
  const firstTurn = turnRefs.get(indices[0])
  firstTurn?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
})
</script>
