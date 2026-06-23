<template>
  <article class="rounded-lg border border-border bg-surface-tertiary p-5">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="text-base font-semibold text-content-primary">
            {{ item.label }}
          </h3>
          <CategoryBadge :category="item.category" />
          <span
            :class="severityClass"
            class="rounded-full px-2.5 py-1 text-xs font-semibold"
          >
            {{ severityLabel }}
          </span>
          <span class="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-content-secondary">
            {{ item.checkType }}
          </span>
          <span class="rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary">
            {{ modeLabel }}
          </span>
        </div>

        <p class="mt-3 text-sm leading-6 text-content-secondary">
          {{ item.description }}
        </p>
      </div>

      <code class="rounded-md bg-white px-3 py-2 text-xs text-content-tertiary">
        {{ item.id }}
      </code>
    </div>

    <div class="mt-5 grid gap-4 md:grid-cols-2">
      <section class="rounded-md bg-white p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
          Applicability
        </p>
        <p class="mt-2 text-sm leading-6 text-content-secondary">
          {{ item.applicability }}
        </p>
      </section>

      <section class="rounded-md bg-white p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
          Trigger Condition
        </p>
        <p class="mt-2 text-sm leading-6 text-content-secondary">
          {{ item.triggerCondition }}
        </p>
      </section>

      <section class="rounded-md bg-white p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
          Out Of Scope
        </p>
        <p class="mt-2 text-sm leading-6 text-content-secondary">
          {{ item.outOfScopeCondition }}
        </p>
      </section>

      <section class="rounded-md bg-white p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
          Evidence Required
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <span
            v-for="evidenceType in evidenceRequired"
            :key="evidenceType"
            class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-content-secondary"
          >
            {{ evidenceType }}
          </span>
        </div>
      </section>
    </div>

    <div class="mt-4 grid gap-4 md:grid-cols-2">
      <section class="rounded-md border border-border bg-white p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
          Success Condition
        </p>
        <p class="mt-2 text-sm leading-6 text-content-secondary">
          {{ item.successCondition }}
        </p>
      </section>

      <section class="rounded-md border border-border bg-white p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
          Failure Condition
        </p>
        <p class="mt-2 text-sm leading-6 text-content-secondary">
          {{ item.failureCondition }}
        </p>
      </section>
    </div>

    <section class="mt-4 rounded-md border border-dashed border-border bg-white p-4">
      <p class="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
        Recommendation Hint
      </p>
      <p class="mt-2 text-sm leading-6 text-content-secondary">
        {{ item.recommendationHint }}
      </p>
    </section>
  </article>
</template>

<script setup>
import { computed } from 'vue'

import CategoryBadge from './CategoryBadge.vue'

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
})

const evidenceRequired = computed(() => Array.isArray(props.item.evidenceRequired) ? props.item.evidenceRequired : [])
const modeLabel = computed(() => props.item.evaluationMode === 'structured_evidence' ? 'Structured Evidence' : 'Semantic')
const severityLabel = computed(() => {
  const severity = String(props.item.severity || '')
  return severity ? `${severity.charAt(0).toUpperCase()}${severity.slice(1)}` : 'Unknown'
})
const severityClass = computed(() => {
  if (props.item.severity === 'critical') {
    return 'bg-rose-100 text-rose-700'
  }

  if (props.item.severity === 'high') {
    return 'bg-amber-100 text-amber-700'
  }

  if (props.item.severity === 'medium') {
    return 'bg-sky-100 text-sky-700'
  }

  return 'bg-emerald-100 text-emerald-700'
})
</script>
