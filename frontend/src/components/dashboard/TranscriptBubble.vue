<script setup>
import { computed } from 'vue'
import { Bot, User, Wrench } from '@lucide/vue'

import { cn } from '@/lib/utils'
import { formatTurnTime } from '@/utils/formatters.js'

const props = defineProps({
  turn: { type: Object, required: true },
  highlighted: { type: Boolean, default: false },
  dimmed: { type: Boolean, default: false },
})

defineEmits(['select'])

const ROLE_META = {
  agent: { icon: Bot, label: 'Agent', chip: 'bg-indigo-100 text-indigo-700' },
  user: { icon: User, label: 'Caller', chip: 'bg-zinc-200 text-zinc-700' },
  action: { icon: Wrench, label: 'Action', chip: 'bg-sky-100 text-sky-700' },
}

const meta = computed(() => ROLE_META[props.turn.role] || ROLE_META.user)
const hasTime = computed(() => typeof props.turn.startTime === 'number')
const toolArgs = computed(() => {
  const args = props.turn.toolArguments
  if (!args || typeof args !== 'object') {
    return ''
  }
  return JSON.stringify(args)
})
</script>

<template>
  <button
    :id="`turn-${turn.index}`"
    type="button"
    :class="cn(
      'w-full scroll-mt-24 rounded-lg border bg-card p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      highlighted
        ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-400'
        : 'border-border hover:border-zinc-300',
      dimmed && !highlighted && 'opacity-55',
    )"
    @click="$emit('select', turn.index)"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="flex items-center gap-1.5">
        <span :class="cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold', meta.chip)">
          <component
            :is="meta.icon"
            class="size-3"
          />
          {{ meta.label }}
        </span>
        <span
          v-if="turn.toolName"
          class="text-[11px] font-medium text-muted-foreground"
        >{{ turn.toolName }}</span>
      </span>
      <span class="text-[11px] tabular-nums text-muted-foreground">
        #{{ turn.index }}<template v-if="hasTime"> · {{ formatTurnTime(turn.startTime) }}</template>
      </span>
    </div>
    <p
      v-if="turn.content"
      class="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground"
    >
      {{ turn.content }}
    </p>
    <p
      v-if="toolArgs"
      class="mt-1 wrap-break-word font-mono text-[11px] text-muted-foreground"
    >
      {{ toolArgs }}
    </p>
  </button>
</template>
