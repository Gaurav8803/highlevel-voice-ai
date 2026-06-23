<script setup>
import { computed } from 'vue'
import { Minus, TrendingDown, TrendingUp } from '@lucide/vue'

import { cn } from '@/lib/utils'

const props = defineProps({
  trend: { type: String, default: 'stable' },
})

const TREND_META = {
  improving: { icon: TrendingUp, color: 'text-emerald-600', label: 'Improving' },
  declining: { icon: TrendingDown, color: 'text-rose-600', label: 'Declining' },
  stable: { icon: Minus, color: 'text-zinc-500', label: 'Stable' },
}

const meta = computed(() => TREND_META[props.trend] || TREND_META.stable)
</script>

<template>
  <span :class="cn('inline-flex items-center gap-1.5 text-sm font-medium', meta.color)">
    <component :is="meta.icon" class="size-4 shrink-0" />
    {{ meta.label }}
  </span>
</template>
