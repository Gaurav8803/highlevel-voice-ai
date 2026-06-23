<script setup>
import { computed } from 'vue'

import { cn } from '@/lib/utils'
import { formatScore, scoreBand } from '@/utils/formatters.js'

const props = defineProps({
  score: { type: [Number, null], default: null },
  size: { type: String, default: 'md' },
})

const BAND_CLASSES = {
  strong: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  acceptable: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  poor: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  none: 'bg-zinc-100 text-zinc-500 ring-zinc-400/30',
}

const SIZE_CLASSES = {
  sm: 'h-6 min-w-10 px-2 text-xs',
  md: 'h-8 min-w-12 px-2.5 text-sm',
  lg: 'h-12 min-w-16 px-4 text-xl',
}

const band = computed(() => scoreBand(props.score))
const label = computed(() => formatScore(props.score))
</script>

<template>
  <span
    :class="cn(
      'inline-flex items-center justify-center rounded-lg font-semibold tabular-nums ring-1 ring-inset',
      BAND_CLASSES[band],
      SIZE_CLASSES[size],
    )"
  >
    {{ label }}
  </span>
</template>
