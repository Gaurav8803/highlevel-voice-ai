<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, Gauge, PhoneCall, RefreshCw, Sparkles, Users } from '@lucide/vue'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import DataTable from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import KpiCard from '@/components/common/KpiCard.vue'
import ScoreBadge from '@/components/common/ScoreBadge.vue'
import { useDashboard } from '@/composables/useDashboard.js'
import { formatDateTime, formatDuration, formatScore } from '@/utils/formatters.js'

const route = useRoute()
const router = useRouter()
const { overview, isLoading, isError, error, runSync, runFullSync, syncing } = useDashboard()

const isEmbedded = computed(() => route.query.embedded === 'true' || window.__VOICE_AI_EMBED__?.embedded === true)
const data = computed(() => overview.value)
const isEmpty = computed(() => !data.value?.totalAgents && !data.value?.totalCalls)
const coverage = computed(() => {
  const total = data.value?.totalCalls || 0
  return total ? Math.round(((data.value?.totalEvaluated || 0) / total) * 100) : 0
})
const scoreTone = computed(() => {
  const score = data.value?.averageScore
  if (typeof score !== 'number') {
    return 'default'
  }
  if (score > 80) {
    return 'positive'
  }
  if (score > 60) {
    return 'warning'
  }
  return 'negative'
})

const agentColumns = [
  { accessorKey: 'agentName', header: 'Agent' },
  { accessorKey: 'averageScore', header: 'Avg score' },
  { accessorKey: 'callCount', header: 'Calls' },
  { accessorKey: 'evaluatedCount', header: 'Evaluated' },
  { accessorKey: 'topIssue', header: 'Top issue', enableSorting: false },
]

const callColumns = [
  { accessorKey: 'agentName', header: 'Agent' },
  { accessorKey: 'calledAt', header: 'Date' },
  { accessorKey: 'duration', header: 'Duration' },
  { accessorKey: 'overallScore', header: 'Score' },
  { accessorKey: 'topFinding', header: 'Top finding', enableSorting: false },
]

function getSharedQuery() {
  return isEmbedded.value ? { ...route.query, embedded: 'true' } : route.query
}

function openAgent(agent) {
  router.push({ path: `/agents/${agent.agentId}`, query: getSharedQuery() })
}

function openCall(call) {
  router.push({ path: `/calls/${call.id}`, query: getSharedQuery() })
}
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-xl font-semibold tracking-tight text-foreground">
          Fleet overview
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Performance and open issues across your synced Voice AI agents.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          variant="outline"
          :disabled="syncing"
          @click="runSync"
        >
          <RefreshCw :class="['size-4', syncing && 'animate-spin']" />
          Sync data
        </Button>
        <Button
          :disabled="syncing"
          @click="runFullSync"
        >
          <Sparkles class="size-4" />
          {{ syncing ? 'Working…' : 'Sync & analyze' }}
        </Button>
      </div>
    </header>

    <div
      v-if="isLoading"
      class="space-y-6"
    >
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton
          v-for="index in 4"
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
        {{ error?.message || 'Failed to load dashboard.' }}
      </p>
    </div>

    <EmptyState
      v-else-if="isEmpty"
      :icon="Sparkles"
      action-label="Sync & analyze"
      description="Bring in your agents and call logs from HighLevel to start surfacing transcript-backed insights."
      title="No dashboard data yet"
      @action="runFullSync"
    />

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          :icon="Gauge"
          :tone="scoreTone"
          :value="formatScore(data.averageScore)"
          label="Avg score"
          sub="Across evaluated calls"
        />
        <KpiCard
          :icon="PhoneCall"
          :value="String(data.totalEvaluated || 0)"
          :sub="`of ${data.totalCalls || 0} calls · ${coverage}% covered`"
          label="Calls analyzed"
        />
        <KpiCard
          :icon="AlertTriangle"
          :tone="data.issuesFound > 0 ? 'negative' : 'default'"
          :value="String(data.issuesFound || 0)"
          label="Open issues"
          sub="Failed findings across calls"
        />
        <KpiCard
          :icon="Users"
          :value="String(data.totalAgents || 0)"
          label="Agents"
          sub="Synced from HighLevel"
        />
      </div>

      <section
        id="agents"
        class="scroll-mt-24 space-y-3"
      >
        <div>
          <h2 class="text-base font-semibold text-foreground">
            Agent leaderboard
          </h2>
          <p class="text-sm text-muted-foreground">
            Sorted lowest-scoring first so the agents needing attention surface on top.
          </p>
        </div>
        <DataTable
          :columns="agentColumns"
          :data="data.agentSummaries"
          :initial-sorting="[{ id: 'averageScore', desc: false }]"
          :page-size="8"
          row-clickable
          searchable
          search-placeholder="Search agents…"
          empty-text="No agents synced yet."
          @row-click="openAgent"
        >
          <template #cell-agentName="{ item }">
            <div class="min-w-0">
              <p class="truncate font-medium text-foreground">
                {{ item.agentName }}
              </p>
              <p class="truncate text-xs text-muted-foreground">
                {{ item.businessName || 'Unknown business' }}
              </p>
            </div>
          </template>
          <template #cell-averageScore="{ item }">
            <ScoreBadge
              :score="item.averageScore"
              size="sm"
            />
          </template>
          <template #cell-evaluatedCount="{ item }">
            <span class="tabular-nums text-muted-foreground">{{ item.evaluatedCount }}</span>
          </template>
          <template #cell-topIssue="{ item }">
            <span
              v-if="item.topIssue"
              class="inline-flex max-w-[16rem] truncate rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
            >{{ item.topIssue }}</span>
            <span
              v-else
              class="text-xs text-muted-foreground/60"
            >—</span>
          </template>
        </DataTable>
      </section>

      <section
        id="calls"
        class="scroll-mt-24 space-y-3"
      >
        <div>
          <h2 class="text-base font-semibold text-foreground">
            Call log history
          </h2>
          <p class="text-sm text-muted-foreground">
            All synced calls, newest first. Search or paginate to review the full call history.
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            Showing {{ data.recentCalls?.length || 0 }} synced calls.
          </p>
        </div>
        <DataTable
          :columns="callColumns"
          :data="data.recentCalls"
          :page-size="8"
          searchable
          search-placeholder="Search call logs…"
          row-clickable
          empty-text="No calls synced yet."
          @row-click="openCall"
        >
          <template #cell-agentName="{ item }">
            <div class="min-w-0">
              <p class="truncate font-medium text-foreground">
                {{ item.agentName || 'Unknown agent' }}
              </p>
              <p class="truncate text-xs text-muted-foreground">
                {{ item.businessName || 'Unknown business' }}
              </p>
            </div>
          </template>
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
          <template #cell-topFinding="{ item }">
            <span class="text-sm text-muted-foreground">{{ item.topFinding || 'No failure recorded' }}</span>
          </template>
        </DataTable>
      </section>
    </template>
  </section>
</template>
