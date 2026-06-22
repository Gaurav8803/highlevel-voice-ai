<template>
  <span
    :class="badgeClasses"
    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
  >
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

import { humanizeCategory } from '../../utils/formatters.js'

const props = defineProps({
  category: {
    type: String,
    default: 'general',
  },
})

const categoryClasses = {
  actions: 'bg-indigo-50 text-indigo-700',
  communication: 'bg-sky-50 text-sky-700',
  compliance: 'bg-rose-50 text-rose-700',
  conversation_flow: 'bg-orange-50 text-orange-700',
  data_capture: 'bg-emerald-50 text-emerald-700',
  extraction: 'bg-emerald-50 text-emerald-700',
  goal_completion: 'bg-violet-50 text-violet-700',
  objection_handling: 'bg-amber-50 text-amber-700',
  routing: 'bg-cyan-50 text-cyan-700',
  timing: 'bg-fuchsia-50 text-fuchsia-700',
}

const label = computed(() => humanizeCategory(props.category))
const badgeClasses = computed(() => categoryClasses[props.category] || 'bg-slate-100 text-slate-600')
</script>
