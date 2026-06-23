<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, Database, FileText, Lightbulb, RefreshCw, TriangleAlert, Wrench } from '@lucide/vue'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import EmptyState from '@/components/common/EmptyState.vue'
import ScoreBadge from '@/components/common/ScoreBadge.vue'
import FindingCard from '@/components/dashboard/FindingCard.vue'
import RecommendationCard from '@/components/dashboard/RecommendationCard.vue'
import TranscriptBubble from '@/components/dashboard/TranscriptBubble.vue'
import UseActionCard from '@/components/dashboard/UseActionCard.vue'
import { useCall } from '@/composables/useCall.js'
import { formatDateTime, formatDuration, humanizeCategory } from '@/utils/formatters.js'

const route = useRoute()
const callId = computed(() => route.params.id)
const { call, isLoading, isError, error, evaluate, evaluating } = useCall(callId)

const isEmbedded = computed(() => route.query.embedded === 'true' || window.__VOICE_AI_EMBED__?.embedded === true)
const detail = computed(() => call.value)
const evaluation = computed(() => detail.value?.evaluation || null)
const turns = computed(() => detail.value?.call?.transcriptTurns || [])
const rubricItems = computed(() => evaluation.value?.evaluatedRubricItems || [])
const emergentFindings = computed(() => evaluation.value?.emergentFindings || [])
const outOfScopeItems = computed(() => evaluation.value?.outOfScopeItems || [])
const useActions = computed(() => evaluation.value?.useActions || [])
const recommendations = computed(() => evaluation.value?.recommendations || [])
const extractedEntries = computed(() => Object.entries(detail.value?.call?.extractedData || {}))
const executedActions = computed(() => (Array.isArray(detail.value?.call?.executedActions) ? detail.value.call.executedActions : []))

const attentionItems = computed(() => rubricItems.value.filter((item) => item.status === 'failed' || item.status === 'partially_met'))
const passedItems = computed(() => rubricItems.value.filter((item) => item.status === 'passed'))
const uncertainItems = computed(() => rubricItems.value.filter((item) => item.status === 'uncertain'))
const hasCritical = computed(() => attentionItems.value.some((item) => item.severity === 'critical')
  || emergentFindings.value.some((item) => item.severity === 'critical' && item.status !== 'passed'))

const selectedFinding = ref(null)
const activeTurnIndices = computed(() => selectedFinding.value?.evidence?.turnIndices || [])

function findingKey(finding) {
  return finding?.id || finding?.rubricItemId || finding?.label || ''
}

const selectedKey = computed(() => findingKey(selectedFinding.value))

function isSelected(finding) {
  return Boolean(selectedKey.value) && findingKey(finding) === selectedKey.value
}

function selectFinding(finding) {
  selectedFinding.value = finding
}

function selectUseAction(action) {
  selectedFinding.value = { evidence: { turnIndices: action.turnIndices || [] }, id: action.id, label: action.finding }
}

function onTurnSelect(index) {
  const match = [...rubricItems.value, ...emergentFindings.value]
    .find((finding) => (finding.evidence?.turnIndices || []).includes(index))

  selectedFinding.value = match || { evidence: { turnIndices: [index] }, label: `Turn ${index}` }
}

function getSharedQuery() {
  return isEmbedded.value ? { ...route.query, embedded: 'true' } : route.query
}

watch(activeTurnIndices, async (indices) => {
  if (!indices.length) {
    return
  }
  await nextTick()
  document.getElementById(`turn-${indices[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
})

watch(callId, () => {
  selectedFinding.value = null
})
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <RouterLink
        class="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        :to="{ path: '/', hash: '#calls', query: getSharedQuery() }"
      >
        <ArrowLeft class="size-4" />
        Call logs
      </RouterLink>
      <Button
        variant="outline"
        size="sm"
        :disabled="evaluating"
        @click="evaluate"
      >
        <RefreshCw :class="['size-4', evaluating && 'animate-spin']" />
        {{ evaluating ? 'Evaluating…' : (evaluation ? 'Re-run evaluation' : 'Run evaluation') }}
      </Button>
    </div>

    <div
      v-if="isLoading"
      class="space-y-4"
    >
      <Skeleton class="h-28 rounded-xl" />
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Skeleton class="h-150 rounded-xl" />
        <Skeleton class="h-150 rounded-xl" />
      </div>
    </div>

    <div
      v-else-if="isError"
      class="rounded-lg border border-rose-200 bg-rose-50 p-5"
    >
      <p class="text-sm font-medium text-rose-700">
        {{ error?.message || 'Failed to load call.' }}
      </p>
    </div>

    <EmptyState
      v-else-if="!detail"
      description="This call record is not available yet."
      title="Call not found"
    />

    <template v-else>
      <Card>
        <CardContent class="space-y-4 p-6">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0">
              <p class="text-sm font-medium text-muted-foreground">
                {{ detail.agent.businessName || 'Unknown business' }}
              </p>
              <h1 class="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {{ detail.agent.agentName || 'Voice AI call' }}
              </h1>
              <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{{ formatDateTime(detail.call.calledAt) }}</span>
                <span>{{ formatDuration(detail.call.duration) }}</span>
                <span>{{ turns.length }} turns</span>
              </div>
            </div>
            <ScoreBadge
              :score="evaluation?.overallScore"
              size="lg"
            />
          </div>

          <div
            v-if="hasCritical"
            class="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700"
          >
            <TriangleAlert class="size-4 shrink-0" />
            This call has a critical finding that needs attention.
          </div>

          <div
            v-if="evaluation?.callPath"
            class="rounded-lg bg-muted px-4 py-3"
          >
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Call path
            </p>
            <p class="mt-1 text-sm leading-relaxed text-foreground">
              {{ evaluation.callPath }}
            </p>
          </div>

          <div
            v-if="detail.agent.rubricSummary"
            class="text-sm text-muted-foreground"
          >
            <span class="font-medium text-foreground">{{ detail.agent.rubricSummary.agentGoalSummary }}</span>
            <span v-if="detail.agent.rubricSummary.primaryGoals?.length"> · Goals: {{ detail.agent.rubricSummary.primaryGoals.join(', ') }}</span>
          </div>
        </CardContent>
      </Card>

      <Card v-if="detail.call.summary">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <FileText class="size-4 text-muted-foreground" />
            Call summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm leading-relaxed text-muted-foreground">
            {{ detail.call.summary }}
          </p>
        </CardContent>
      </Card>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] xl:items-start">
        <Card class="overflow-hidden">
          <CardHeader>
            <CardTitle class="text-base">
              Transcript
            </CardTitle>
            <p class="text-sm text-muted-foreground">
              Click a finding to jump here — or click a turn to surface the findings that cite it.
            </p>
          </CardHeader>
          <CardContent>
            <div
              v-if="turns.length"
              class="space-y-2.5"
            >
              <TranscriptBubble
                v-for="turn in turns"
                :key="turn.index"
                :turn="turn"
                :highlighted="activeTurnIndices.includes(turn.index)"
                :dimmed="activeTurnIndices.length > 0"
                @select="onTurnSelect"
              />
            </div>
            <EmptyState
              v-else
              description="This call does not have normalized transcript turns yet."
              title="No transcript available"
            />
          </CardContent>
        </Card>

        <div class="space-y-3 xl:sticky xl:top-6 xl:self-start">
          <EmptyState
            v-if="!evaluation"
            :icon="Lightbulb"
            action-label="Run evaluation"
            description="This call has not been evaluated yet."
            title="No evaluation stored"
            @action="evaluate"
          />

          <template v-else>
            <Accordion
              type="single"
              collapsible
              default-value="rubric-findings"
              class="rounded-lg border bg-card px-4"
            >
              <AccordionItem
                value="rubric-findings"
                class="border-none"
              >
                <AccordionTrigger class="hover:no-underline">
                  <span class="flex flex-1 flex-wrap items-center justify-between gap-2 pr-2">
                    <span class="text-sm font-semibold text-foreground">Rubric findings</span>
                    <span class="flex items-center gap-1.5 text-xs font-normal">
                      <span class="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">{{ attentionItems.length }} attn</span>
                      <span class="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">{{ passedItems.length }} pass</span>
                      <span class="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-600">{{ uncertainItems.length }} unc</span>
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent class="space-y-4">
                  <div
                    v-if="attentionItems.length"
                    class="space-y-2"
                  >
                    <p class="text-xs font-semibold uppercase tracking-wide text-rose-600">
                      Needs attention
                    </p>
                    <FindingCard
                      v-for="finding in attentionItems"
                      :key="findingKey(finding)"
                      :finding="finding"
                      :selected="isSelected(finding)"
                      @select="selectFinding"
                    />
                  </div>
                  <div
                    v-if="passedItems.length"
                    class="space-y-2"
                  >
                    <p class="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                      Passed
                    </p>
                    <FindingCard
                      v-for="finding in passedItems"
                      :key="findingKey(finding)"
                      :finding="finding"
                      :selected="isSelected(finding)"
                      @select="selectFinding"
                    />
                  </div>
                  <div
                    v-if="uncertainItems.length"
                    class="space-y-2"
                  >
                    <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Uncertain
                    </p>
                    <FindingCard
                      v-for="finding in uncertainItems"
                      :key="findingKey(finding)"
                      :finding="finding"
                      :selected="isSelected(finding)"
                      @select="selectFinding"
                    />
                  </div>
                  <p
                    v-if="!rubricItems.length"
                    class="text-sm text-muted-foreground"
                  >
                    No rubric items were evaluated for this call.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Accordion
              v-if="emergentFindings.length"
              type="single"
              collapsible
              class="rounded-lg border bg-card px-4"
            >
              <AccordionItem
                value="discovered"
                class="border-none"
              >
                <AccordionTrigger class="text-sm font-semibold text-foreground hover:no-underline">
                  Discovered issues ({{ emergentFindings.length }})
                </AccordionTrigger>
                <AccordionContent class="space-y-2">
                  <FindingCard
                    v-for="finding in emergentFindings"
                    :key="findingKey(finding)"
                    :finding="finding"
                    :selected="isSelected(finding)"
                    @select="selectFinding"
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Accordion
              v-if="useActions.length"
              type="single"
              collapsible
              class="rounded-lg border bg-card px-4"
            >
              <AccordionItem
                value="use-actions"
                class="border-none"
              >
                <AccordionTrigger class="text-sm font-semibold text-foreground hover:no-underline">
                  What to do about this call ({{ useActions.length }})
                </AccordionTrigger>
                <AccordionContent class="space-y-2.5">
                  <UseActionCard
                    v-for="action in useActions"
                    :key="action.id"
                    :action="action"
                    selectable
                    :selected="selectedKey === action.id"
                    @select="selectUseAction"
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Accordion
              v-if="recommendations.length"
              type="single"
              collapsible
              class="rounded-lg border bg-card px-4"
            >
              <AccordionItem
                value="recommendations"
                class="border-none"
              >
                <AccordionTrigger class="text-sm font-semibold text-foreground hover:no-underline">
                  Recommendations ({{ recommendations.length }})
                </AccordionTrigger>
                <AccordionContent class="space-y-2.5">
                  <RecommendationCard
                    v-for="(recommendation, index) in recommendations"
                    :key="recommendation.title || index"
                    :recommendation="recommendation"
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Accordion
              v-if="outOfScopeItems.length"
              type="single"
              collapsible
              class="rounded-lg border bg-card px-4"
            >
              <AccordionItem
                value="out-of-scope"
                class="border-none"
              >
                <AccordionTrigger class="text-sm font-semibold text-foreground hover:no-underline">
                  Out of scope ({{ outOfScopeItems.length }})
                </AccordionTrigger>
                <AccordionContent class="space-y-2">
                  <div
                    v-for="item in outOfScopeItems"
                    :key="item.rubricItemId"
                    class="rounded-md bg-muted px-3 py-2"
                  >
                    <p class="text-sm font-medium text-foreground">
                      {{ item.label }}
                    </p>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      {{ item.reason }}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </template>
        </div>
      </div>

      <div
        v-if="extractedEntries.length || executedActions.length"
        class="grid gap-6 lg:grid-cols-2"
      >
        <Card v-if="extractedEntries.length">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-base">
              <Database class="size-4 text-muted-foreground" />
              Extracted data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl class="space-y-2">
              <div
                v-for="[key, value] in extractedEntries"
                :key="key"
                class="flex justify-between gap-3 border-b pb-2 text-sm last:border-none last:pb-0"
              >
                <dt class="text-muted-foreground">
                  {{ humanizeCategory(key) }}
                </dt>
                <dd class="max-w-[60%] truncate text-right font-medium text-foreground">
                  {{ typeof value === 'object' ? JSON.stringify(value) : value }}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card v-if="executedActions.length">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-base">
              <Wrench class="size-4 text-muted-foreground" />
              Executed actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul class="space-y-2">
              <li
                v-for="(action, index) in executedActions"
                :key="action.actionId || index"
                class="rounded-md bg-muted px-3 py-2 text-sm"
              >
                <p class="font-medium text-foreground">
                  {{ action.actionName || action.actionType || 'Action' }}
                </p>
                <p
                  v-if="action.actionType"
                  class="text-xs text-muted-foreground"
                >
                  {{ humanizeCategory(action.actionType) }}
                </p>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </template>
  </section>
</template>
