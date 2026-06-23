<script setup>
import { computed } from 'vue'
import { CircleCheck, CircleDashed, CircleHelp, CircleX } from '@lucide/vue'

import { cn } from '@/lib/utils'

const props = defineProps({
  status: { type: String, default: '' },
  withLabel: { type: Boolean, default: false },
})

const STATUS_META = {
  passed: { icon: CircleCheck, color: 'text-emerald-600', label: 'Passed' },
  failed: { icon: CircleX, color: 'text-rose-600', label: 'Failed' },
  partially_met: { icon: CircleDashed, color: 'text-amber-600', label: 'Partially met' },
  uncertain: { icon: CircleHelp, color: 'text-zinc-400', label: 'Uncertain' },
}

const meta = computed(() => STATUS_META[props.status] || STATUS_META.uncertain)
</script>

<template>
  <span :class="cn('inline-flex items-center gap-1.5', meta.color)">
    <component :is="meta.icon" class="size-4 shrink-0" />
    <span
      v-if="withLabel"
      class="text-xs font-medium"
    >{{ meta.label }}</span>
  </span>
</template>
