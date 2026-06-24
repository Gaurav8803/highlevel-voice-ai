<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ChevronDown, Clock, Database, Gauge, PhoneCall, RefreshCw, Timer } from '@lucide/vue'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CategoryBadge from '@/components/common/CategoryBadge.vue'
import DataTable from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import KpiCard from '@/components/common/KpiCard.vue'
import ScoreBadge from '@/components/common/ScoreBadge.vue'
import RecommendationCard from '@/components/dashboard/RecommendationCard.vue'
import RubricItemCard from '@/components/dashboard/RubricItemCard.vue'
import ScoreTrendChart from '@/components/dashboard/ScoreTrendChart.vue'
import UseActionCard from '@/components/dashboard/UseActionCard.vue'
import { useAgent } from '@/composables/useAgent.js'
import { formatDateTime, formatDuration, formatPercent } from '@/utils/formatters.js'

const route = useRoute()
const router = useRouter()
const agentId = computed(() => route.params.id)
const { agent, isLoading, isError, error, regenerateRubric, rubricPending } = useAgent(agentId)

const isEmbedded = computed(() => route.query.embedded === 'true' || window.__VOICE_AI_EMBED__?.embedded === true)
const detail = computed(() => agent.value)
const agentAnalysis = computed(() => detail.value?.agentAnalysis || null)
const agentAnalysisSummary = computed(() => agentAnalysis.value?.overallAssessment || '')
const metrics = computed(() => detail.value?.metrics || {})
const rubric = computed(() => detail.value?.agent?.rubric || null)
const rubricItems = computed(() => (Array.isArray(rubric.value?.rubric) ? rubric.value.rubric : []))
const primaryGoals = computed(() => (Array.isArray(rubric.value?.primaryGoals) ? rubric.value.primaryGoals : []))
const goalSummary = computed(() => rubric.value?.agentGoalSummary || 'Rubric generation has not completed for this agent yet.')
const isLongDescription = computed(() => goalSummary.value.length > 160)
const descriptionExpanded = ref(false)
watch(agentId, () => {
  descriptionExpanded.value = false
})
const scoreOverTime = computed(() => metrics.value.scoreOverTime || [])
const findingFrequency = computed(() => metrics.value.findingFrequency || [])
const actionSuccessRates = computed(() => metrics.value.actionSuccessRates || [])
const useActions = computed(() => detail.value?.useActions || [])
const recommendations = computed(() => detail.value?.topRecommendations || [])

const USE_ACTION_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'script_training', label: 'Script training' },
  { value: 'workflow_fix', label: 'Workflow fix' },
]

function useActionsByType(type) {
  return type === 'all' ? useActions.value : useActions.value.filter((action) => action.actionType === type)
}

const findingColumns = [
  { id: 'expander', header: '', enableSorting: false },
  { accessorKey: 'finding', header: 'Finding' },
  { accessorKey: 'category', header: 'Category', enableSorting: false },
  { accessorKey: 'count', header: 'Count' },
]

const callColumns = [
  { accessorKey: 'calledAt', header: 'Date' },
  { accessorKey: 'duration', header: 'Duration' },
  { accessorKey: 'overallScore', header: 'Score' },
]

function barTone(rate) {
  if (typeof rate !== 'number') {
    return 'bg-zinc-400'
  }
  if (rate > 80) {
    return 'bg-emerald-500'
  }
  if (rate > 60) {
    return 'bg-amber-500'
  }
  return 'bg-rose-500'
}

function sampleEvidenceQuotes(finding) {
  return Array.isArray(finding.sampleEvidence?.quotes) ? finding.sampleEvidence.quotes : []
}

function getSharedQuery() {
  return isEmbedded.value ? { ...route.query, embedded: 'true' } : route.query
}

function openCall(call) {
  router.push({ path: `/calls/${call.id}`, query: getSharedQuery() })
}
</script>

<template>
  <section class="space-y-6">
    <RouterLink
      class="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      :to="{ path: '/', hash: '#agents', query: getSharedQuery() }"
    >
      <ArrowLeft class="size-4" />
      All agents
    </RouterLink>

    <div
      v-if="isLoading"
      class="space-y-4"
    >
      <Skeleton class="h-28 rounded-xl" />
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Skeleton
          v-for="index in 5"
          :key="`kpi-${index}`"
          class="h-24 rounded-xl"
        />
      </div>
      <Skeleton class="h-72 rounded-xl" />
    </div>

    <div
      v-else-if="isError"
      class="rounded-lg border border-rose-200 bg-rose-50 p-5"
    >
      <p class="text-sm font-medium text-rose-700">
        {{ error?.message || 'Failed to load agent.' }}
      </p>
    </div>

    <EmptyState
      v-else-if="!detail"
      description="This agent record is not available yet."
      title="Agent not found"
    />

    <template v-else>
      <Card>
        <CardContent class="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <p class="text-sm font-medium text-muted-foreground">
              {{ detail.agent.businessName || 'Unknown business' }}
            </p>
            <h1 class="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {{ detail.agent.agentName }}
            </h1>
            <div class="mt-3 max-w-2xl">
              <p :class="['text-sm leading-relaxed text-muted-foreground', !descriptionExpanded && isLongDescription && 'line-clamp-2']">
                {{ goalSummary }}
              </p>
              <button
                v-if="isLongDescription"
                type="button"
                class="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                @click="descriptionExpanded = !descriptionExpanded"
              >
                {{ descriptionExpanded ? 'Show less' : 'Read more' }}
              </button>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-4 lg:flex-col lg:items-end">
            <ScoreBadge
              :score="metrics.averageScore"
              size="lg"
            />
            <Button
              variant="outline"
              size="sm"
              :disabled="rubricPending"
              @click="regenerateRubric"
            >
              <RefreshCw :class="['size-4', rubricPending && 'animate-spin']" />
              {{ rubricPending ? 'Generating…' : 'Refresh rubric' }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          :icon="Gauge"
          :value="`${Math.round(metrics.averageScore || 0)}`"
          label="Avg score"
        />
        <KpiCard
          :icon="PhoneCall"
          :value="String(metrics.totalCalls || 0)"
          label="Total calls"
        />
        <KpiCard
          :icon="Timer"
          :value="`${(metrics.averageResponseLatency || 0).toFixed(1)}s`"
          label="Avg latency"
        />
        <KpiCard
          :icon="Database"
          :value="formatPercent(metrics.extractionCompleteness)"
          label="Extraction"
        />
        <KpiCard
          :icon="Clock"
          :value="formatDuration(metrics.averageDuration)"
          label="Avg duration"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle class="text-base">
            Score over time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScoreTrendChart
            v-if="scoreOverTime.length >= 2"
            :points="scoreOverTime"
          />
          <EmptyState
            v-else
            description="This agent needs at least two evaluated calls before a trend can be plotted."
            title="Not enough data for a trend"
          />
        </CardContent>
      </Card>

      <Tabs default-value="findings">
        <TabsList>
          <TabsTrigger value="findings">
            Findings
          </TabsTrigger>
          <TabsTrigger value="fix">
            What to fix
          </TabsTrigger>
          <TabsTrigger value="rubric">
            Rubric
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="findings"
          class="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start"
        >
          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-foreground">
              Most frequent failed findings
            </h3>
            <DataTable
              v-if="findingFrequency.length"
              :columns="findingColumns"
              :data="findingFrequency"
              :page-size="8"
              empty-text="No recurring findings yet."
            >
              <template #cell-expander="{ row }">
                <button
                  type="button"
                  :aria-label="row.getIsExpanded() ? 'Collapse evidence' : 'Expand evidence'"
                  :aria-expanded="row.getIsExpanded()"
                  class="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  @click="row.toggleExpanded()"
                >
                  <ChevronDown :class="cn('size-4 transition-transform', row.getIsExpanded() && 'rotate-180')" />
                </button>
              </template>
              <template #cell-finding="{ item }">
                <span class="font-medium text-foreground">{{ item.finding }}</span>
              </template>
              <template #cell-category="{ item }">
                <CategoryBadge :category="item.category" />
              </template>
              <template #cell-count="{ item }">
                <span class="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground">{{ item.count }}×</span>
              </template>
              <template #expanded="{ item }">
                <div class="space-y-2 px-4 py-3">
                  <p
                    v-if="item.sampleEvidence?.reasoning"
                    class="text-sm text-muted-foreground"
                  >
                    {{ item.sampleEvidence.reasoning }}
                  </p>
                  <p
                    v-for="(quote, index) in sampleEvidenceQuotes(item)"
                    :key="index"
                    class="rounded-md bg-card px-2.5 py-1.5 text-xs italic text-foreground"
                  >
                    “{{ quote }}”
                  </p>
                  <p
                    v-if="item.sampleEvidence?.turnIndices?.length"
                    class="text-[11px] text-muted-foreground"
                  >
                    Referenced turns: {{ item.sampleEvidence.turnIndices.join(', ') }}
                  </p>
                </div>
              </template>
            </DataTable>
            <EmptyState
              v-else
              description="Finding frequencies appear once failed checks and semantic findings are stored."
              title="No findings yet"
            />
          </div>

          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-foreground">
              Workflow success rates
            </h3>
            <Card v-if="actionSuccessRates.length">
              <CardContent class="space-y-4 p-5">
                <div
                  v-for="action in actionSuccessRates"
                  :key="action.actionName"
                >
                  <div class="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span class="truncate font-medium text-foreground">{{ action.actionName }}</span>
                    <span class="shrink-0 text-xs text-muted-foreground">
                      {{ action.passedCount }} pass
                      <span v-if="action.partiallyMetCount"> · {{ action.partiallyMetCount }} partial</span>
                      <span v-if="typeof action.rate === 'number'"> · {{ Math.round(action.rate) }}%</span>
                    </span>
                  </div>
                  <div class="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      :class="cn('h-full rounded-full', barTone(action.rate))"
                      :style="{ width: `${action.rate || 0}%` }"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            <EmptyState
              v-else
              description="Workflow and automation success rates populate once action-related KPIs are evaluated."
              title="No workflow KPI data"
            />
          </div>
        </TabsContent>

        <TabsContent
          value="fix"
          class="space-y-8"
        >
          <Card v-if="agentAnalysisSummary">
            <CardHeader>
              <CardTitle class="text-base">
                Agent-wide analysis
              </CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <p class="text-sm leading-relaxed text-muted-foreground">
                {{ agentAnalysisSummary }}
              </p>
              <p class="text-xs text-muted-foreground">
                Based on the current agent prompt, rubric, and all stored call transcripts for this agent.
              </p>
            </CardContent>
          </Card>

          <div class="space-y-3">
            <div>
              <h3 class="text-sm font-semibold text-foreground">
                Recommended actions
              </h3>
              <p class="text-sm text-muted-foreground">
                Prioritized by severity, then how many calls each issue affects.
              </p>
            </div>
            <Tabs
              v-if="useActions.length"
              default-value="all"
            >
              <TabsList>
                <TabsTrigger
                  v-for="filter in USE_ACTION_FILTERS"
                  :key="filter.value"
                  :value="filter.value"
                >
                  {{ filter.label }}
                  <span class="ml-1 text-xs text-muted-foreground">{{ useActionsByType(filter.value).length }}</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent
                v-for="filter in USE_ACTION_FILTERS"
                :key="filter.value"
                :value="filter.value"
                class="grid gap-3 md:grid-cols-2"
              >
                <UseActionCard
                  v-for="(action, index) in useActionsByType(filter.value)"
                  :key="`${action.actionType}-${action.finding}-${index}`"
                  :action="action"
                />
                <p
                  v-if="!useActionsByType(filter.value).length"
                  class="text-sm text-muted-foreground"
                >
                  No items in this category.
                </p>
              </TabsContent>
            </Tabs>
            <EmptyState
              v-else
              description="Use actions populate once failed findings are aggregated across this agent's calls."
              title="No recommended actions yet"
            />
          </div>

          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-foreground">
              Top recommendations
            </h3>
            <div
              v-if="recommendations.length"
              class="grid gap-3"
            >
              <RecommendationCard
                v-for="(recommendation, index) in recommendations"
                :key="recommendation.title || index"
                :rank="index + 1"
                :recommendation="recommendation"
              />
            </div>
            <EmptyState
              v-else
              description="Recommendations populate once this agent has semantic evaluations."
              title="No recommendations yet"
            />
          </div>
        </TabsContent>

        <TabsContent
          value="rubric"
          class="space-y-4"
        >
          <Card>
            <CardContent class="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
              <div class="max-w-3xl">
                <h3 class="text-sm font-semibold text-foreground">
                  Rubric goal
                </h3>
                <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {{ rubric?.agentGoalSummary || 'Rubric generation has not completed for this agent yet.' }}
                </p>
                <div
                  v-if="primaryGoals.length"
                  class="mt-3 flex flex-wrap gap-1.5"
                >
                  <span
                    v-for="goal in primaryGoals"
                    :key="goal"
                    class="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {{ goal }}
                  </span>
                </div>
              </div>
              <span class="shrink-0 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                <span class="font-semibold text-foreground">{{ rubricItems.length }}</span> items
              </span>
            </CardContent>
          </Card>
          <div
            v-if="rubricItems.length"
            class="grid gap-3"
          >
            <RubricItemCard
              v-for="item in rubricItems"
              :key="item.id"
              :item="item"
            />
          </div>
          <EmptyState
            v-else
            description="Refresh the rubric to render the agent evaluation contract here."
            title="No rubric items yet"
          />
        </TabsContent>
      </Tabs>

      <section class="space-y-3">
        <h2 class="text-base font-semibold text-foreground">
          Calls
        </h2>
        <DataTable
          :columns="callColumns"
          :data="detail.calls"
          :initial-sorting="[{ id: 'calledAt', desc: true }]"
          :page-size="10"
          row-clickable
          empty-text="No calls recorded for this agent yet."
          @row-click="openCall"
        >
          <template #cell-calledAt="{ item }">
            <span class="text-sm text-muted-foreground">{{ formatDateTime(item.calledAt) }}</span>
          </template>
          <template #cell-duration="{ item }">
            <span class="text-sm text-muted-foreground">{{ formatDuration(item.duration) }}</span>
          </template>
          <template #cell-overallScore="{ item }">
            <ScoreBadge
              :score="item.overallScore"
              size="sm"
            />
          </template>
        </DataTable>
      </section>
    </template>
  </section>
</template>
