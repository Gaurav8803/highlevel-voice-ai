<template>
  <div
    :class="badgeClasses"
    class="inline-flex items-center justify-center rounded-full font-semibold"
  >
    <span>{{ formattedScore }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

import { formatScore, getScoreTone } from '../../utils/formatters.js'

const props = defineProps({
  score: {
    type: Number,
    default: null,
  },
  size: {
    type: String,
    default: 'md',
  },
})

const sizeClasses = {
  lg: 'h-16 w-16 text-lg',
  md: 'h-12 w-12 text-sm',
  sm: 'h-9 w-9 text-xs',
}

const toneClasses = {
  fail: 'bg-red-50 text-red-700 ring-1 ring-red-100',
  neutral: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  pass: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  warn: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
}

const formattedScore = computed(() => formatScore(props.score))
const badgeClasses = computed(() => {
  const tone = getScoreTone(props.score)
  return `${sizeClasses[props.size] || sizeClasses.md} ${toneClasses[tone]}`
})
</script>
