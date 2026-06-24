<script setup>
import { computed } from 'vue'
import { CornerDownRight } from '@lucide/vue'

import { cn } from '@/lib/utils'
import SeverityBadge from '@/components/common/SeverityBadge.vue'
import UseActionBadge from '@/components/common/UseActionBadge.vue'

const props = defineProps({
  action: { type: Object, required: true },
  selectable: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
})

defineEmits(['select'])

const quotes = computed(() => (Array.isArray(props.action.quotes) ? props.action.quotes : []))
const turnIndices = computed(() => (Array.isArray(props.action.turnIndices) ? props.action.turnIndices : []))
</script>

<template>
  <component
    :is="selectable ? 'button' : 'div'"
    :type="selectable ? 'button' : undefined"
    :class="cn(
      'block w-full rounded-lg border bg-card p-4 text-left transition-colors',
      selectable && 'hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      selected ? 'border-blue-400 ring-1 ring-blue-400' : 'border-border',
    )"
    @click="selectable && $emit('select', action)"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-1.5">
        <UseActionBadge :action-type="action.actionType" />
        <SeverityBadge :severity="action.severity" />
      </div>
      <span
        v-if="typeof action.affectedCalls === 'number'"
        class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
      >
        {{ action.affectedCalls }} {{ action.affectedCalls === 1 ? 'call' : 'calls' }}
      </span>
    </div>

    <h4 class="mt-2.5 text-sm font-semibold text-foreground">
      {{ action.finding }}
    </h4>
    <p
      v-if="action.recommendation"
      class="mt-1.5 flex gap-1.5 text-sm leading-relaxed text-muted-foreground"
    >
      <CornerDownRight class="mt-0.5 size-3.5 shrink-0 text-blue-600" />
      <span>{{ action.recommendation }}</span>
    </p>

    <p
      v-for="(quote, index) in quotes"
      :key="index"
      class="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-xs italic text-foreground"
    >
      “{{ quote }}”
    </p>

    <p
      v-if="selectable && turnIndices.length"
      class="mt-2 text-[11px] font-medium text-blue-700"
    >
      Jump to turns {{ turnIndices.join(', ') }} →
    </p>
  </component>
</template>
