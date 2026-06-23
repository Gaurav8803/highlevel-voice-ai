<script setup>
import { computed } from 'vue'

import { cn } from '@/lib/utils'
import { humanizeCategory } from '@/utils/formatters.js'

const props = defineProps({
  severity: { type: String, default: '' },
})

const SEVERITY_CLASSES = {
  critical: 'bg-rose-100 text-rose-700 ring-rose-600/20',
  high: 'bg-orange-100 text-orange-700 ring-orange-600/20',
  medium: 'bg-amber-100 text-amber-700 ring-amber-600/20',
  low: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}

const tone = computed(() => SEVERITY_CLASSES[props.severity] || 'bg-zinc-100 text-zinc-600 ring-zinc-400/20')
</script>

<template>
  <span
    v-if="severity"
    :class="cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tone)"
  >
    {{ humanizeCategory(severity) }}
  </span>
</template>
