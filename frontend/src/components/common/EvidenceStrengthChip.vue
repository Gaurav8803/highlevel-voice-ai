<script setup>
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = defineProps({
  strength: { type: String, default: '' },
})

const STRENGTH_CLASSES = {
  strong: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  weak: 'bg-zinc-100 text-zinc-500',
}

const tone = computed(() => STRENGTH_CLASSES[props.strength] || 'bg-zinc-100 text-zinc-500')
</script>

<template>
  <span
    v-if="strength"
    :class="cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', tone)"
  >
    {{ strength }} evidence
  </span>
</template>
