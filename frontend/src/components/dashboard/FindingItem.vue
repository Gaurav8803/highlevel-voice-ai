<template>
  <article
    :class="[
      selected ? 'border-primary ring-1 ring-primary/15' : 'border-border',
      'rounded-lg border bg-white shadow-card',
    ]"
  >
    <button
      class="flex w-full items-start gap-3 px-4 py-4 text-left"
      type="button"
      @click="toggle"
    >
      <StatusDot :status="status" />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <p class="text-sm font-semibold text-content-primary">
            {{ finding.label }}
          </p>
          <CategoryBadge :category="finding.category" />
          <span
            v-if="finding.source === 'llm_semantic'"
            class="rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary"
          >
            Semantic
          </span>
        </div>
        <p
          v-if="finding.recommendation"
          class="mt-2 text-sm text-content-secondary"
        >
          {{ finding.recommendation }}
        </p>
        <div
          v-if="showConfidence"
          class="mt-3"
        >
          <div class="mb-1 flex items-center justify-between text-xs text-content-tertiary">
            <span>Confidence</span>
            <span>{{ confidenceLabel }}</span>
          </div>
          <div class="h-1.5 rounded-full bg-slate-100">
            <div
              class="h-1.5 rounded-full bg-primary"
              :style="{ width: confidenceWidth }"
            />
          </div>
        </div>
      </div>
      <span class="pt-0.5 text-xs text-content-tertiary">
        {{ expanded ? 'Hide' : 'Details' }}
      </span>
    </button>

    <div
      v-if="expanded"
      class="border-t border-border px-4 py-4"
    >
      <div
        v-if="evidenceRows.length"
        class="space-y-3"
      >
        <div
          v-for="row in evidenceRows"
          :key="row.label"
          class="rounded-md bg-surface-tertiary px-3 py-2"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
            {{ row.label }}
          </p>
          <p class="mt-1 text-sm text-content-secondary">
            {{ row.value }}
          </p>
        </div>
      </div>
      <p
        v-else
        class="text-sm text-content-secondary"
      >
        No evidence details are available for this finding yet.
      </p>
    </div>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

import CategoryBadge from './CategoryBadge.vue'
import StatusDot from './StatusDot.vue'

const emit = defineEmits(['select'])

const props = defineProps({
  finding: {
    type: Object,
    required: true,
  },
  initiallyExpanded: {
    type: Boolean,
    default: false,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  showConfidence: {
    type: Boolean,
    default: false,
  },
})

const expanded = ref(props.initiallyExpanded)

watch(
  () => props.selected,
  (selected) => {
    if (selected) {
      expanded.value = true
    }
  }
)

const status = computed(() => {
  if (props.finding.passed === true) {
    return 'pass'
  }

  if (props.finding.passed === false) {
    return 'fail'
  }

  return 'warn'
})

const confidenceWidth = computed(() => `${Math.round((props.finding.confidence || 0) * 100)}%`)
const confidenceLabel = computed(() => `${Math.round((props.finding.confidence || 0) * 100)}%`)
const evidenceRows = computed(() => {
  const evidence = props.finding.evidence || {}
  const rows = []

  if (Array.isArray(evidence.turnIndices) && evidence.turnIndices.length > 0) {
    rows.push({
      label: 'Referenced Turns',
      value: evidence.turnIndices.join(', '),
    })
  }

  if (Array.isArray(evidence.quotes) && evidence.quotes.length > 0) {
    rows.push({
      label: 'Transcript Evidence',
      value: evidence.quotes.join(' | '),
    })
  }

  if (evidence.reasoning) {
    rows.push({
      label: 'Reasoning',
      value: evidence.reasoning,
    })
  }

  if (evidence.expected !== undefined) {
    rows.push({
      label: 'Expected',
      value: typeof evidence.expected === 'string' ? evidence.expected : JSON.stringify(evidence.expected),
    })
  }

  if (evidence.actual !== undefined) {
    rows.push({
      label: 'Actual',
      value: typeof evidence.actual === 'string' ? evidence.actual : JSON.stringify(evidence.actual),
    })
  }

  return rows
})

function toggle() {
  expanded.value = !expanded.value
  emit('select', props.finding)
}
</script>
