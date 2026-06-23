<script setup>
import { computed } from 'vue'

import { humanizeCategory } from '@/utils/formatters.js'

const props = defineProps({
  recommendation: { type: Object, required: true },
  rank: { type: Number, default: null },
})

const relatedRubricItems = computed(() => (Array.isArray(props.recommendation.relatedRubricItems) ? props.recommendation.relatedRubricItems : []))
const title = computed(() => props.recommendation.title || props.recommendation.label || 'Recommendation')
const description = computed(() => props.recommendation.description || props.recommendation.recommendation || '')
</script>

<template>
  <article class="flex gap-3 rounded-lg border bg-card p-4">
    <span
      v-if="rank !== null"
      class="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white"
    >
      {{ rank }}
    </span>
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-sm font-semibold text-foreground">
          {{ title }}
        </h4>
        <span
          v-if="typeof recommendation.frequency === 'number'"
          class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
        >
          {{ recommendation.frequency }}×
        </span>
      </div>
      <div class="mt-1 flex flex-wrap items-center gap-1.5">
        <span
          v-if="recommendation.priority"
          class="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600"
        >
          Priority {{ recommendation.priority }}
        </span>
        <span
          v-if="recommendation.impactArea"
          class="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
        >
          {{ humanizeCategory(recommendation.impactArea) }}
        </span>
      </div>
      <p
        v-if="description"
        class="mt-2 text-sm leading-relaxed text-muted-foreground"
      >
        {{ description }}
      </p>
      <div
        v-if="relatedRubricItems.length"
        class="mt-2.5 flex flex-wrap gap-1.5"
      >
        <span
          v-for="relatedItem in relatedRubricItems"
          :key="relatedItem"
          class="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
        >
          {{ relatedItem }}
        </span>
      </div>
    </div>
  </article>
</template>
