<script setup>
import { computed } from 'vue'

import CategoryBadge from '@/components/common/CategoryBadge.vue'
import SeverityBadge from '@/components/common/SeverityBadge.vue'
import { humanizeCategory } from '@/utils/formatters.js'

const props = defineProps({
  item: { type: Object, required: true },
})

const evidenceRequired = computed(() => (Array.isArray(props.item.evidenceRequired) ? props.item.evidenceRequired : []))
const modeLabel = computed(() => (props.item.evaluationMode === 'structured_evidence' ? 'Structured evidence' : 'Semantic'))

const DETAILS = [
  { key: 'applicability', label: 'Applicability' },
  { key: 'triggerCondition', label: 'Trigger condition' },
  { key: 'successCondition', label: 'Success condition' },
  { key: 'failureCondition', label: 'Failure condition' },
  { key: 'outOfScopeCondition', label: 'Out of scope' },
  { key: 'recommendationHint', label: 'Recommendation hint' },
]

const details = computed(() => DETAILS.filter((detail) => props.item[detail.key]))
</script>

<template>
  <article class="rounded-lg border bg-card p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-foreground">
          {{ item.label }}
        </h3>
        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
          <CategoryBadge :category="item.category" />
          <SeverityBadge :severity="item.severity" />
          <span class="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {{ humanizeCategory(item.checkType) }}
          </span>
          <span class="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {{ modeLabel }}
          </span>
        </div>
      </div>
      <code class="rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">{{ item.id }}</code>
    </div>

    <p
      v-if="item.description"
      class="mt-3 text-sm leading-relaxed text-muted-foreground"
    >
      {{ item.description }}
    </p>

    <dl class="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
      <div
        v-for="detail in details"
        :key="detail.key"
      >
        <dt class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {{ detail.label }}
        </dt>
        <dd class="mt-0.5 text-sm leading-snug text-foreground">
          {{ item[detail.key] }}
        </dd>
      </div>
    </dl>

    <div
      v-if="evidenceRequired.length"
      class="mt-3 flex flex-wrap items-center gap-1.5"
    >
      <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Evidence</span>
      <span
        v-for="evidenceType in evidenceRequired"
        :key="evidenceType"
        class="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
      >
        {{ evidenceType }}
      </span>
    </div>
  </article>
</template>
