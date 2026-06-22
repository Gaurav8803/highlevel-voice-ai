<template>
  <article
    :class="wrapperClasses"
    class="flex"
  >
    <div
      :class="bubbleClasses"
      class="max-w-[88%] rounded-lg border px-4 py-3 shadow-sm"
    >
      <div class="mb-1 flex items-center justify-between gap-3">
        <span class="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
          {{ speakerLabel }}
        </span>
        <span class="text-xs text-content-tertiary">
          {{ timestamp }}
        </span>
      </div>
      <p class="whitespace-pre-wrap text-sm leading-6 text-content-primary">
        {{ turn.content || fallbackContent }}
      </p>
      <div
        v-if="turn.role === 'action' && (turn.toolName || turn.toolType)"
        class="mt-3 flex flex-wrap gap-2 text-xs text-content-secondary"
      >
        <span class="rounded-full bg-white/70 px-2 py-1">
          {{ turn.toolName || 'Action' }}
        </span>
        <span
          v-if="turn.toolType"
          class="rounded-full bg-white/70 px-2 py-1"
        >
          {{ turn.toolType }}
        </span>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'

import { formatTurnTime } from '../../utils/formatters.js'

const props = defineProps({
  highlighted: {
    type: Boolean,
    default: false,
  },
  tone: {
    type: String,
    default: 'warn',
  },
  turn: {
    type: Object,
    required: true,
  },
})

const bubbleToneClasses = {
  agent: 'border-indigo-100 bg-primary-light',
  action: 'border-amber-200 bg-amber-50',
  user: 'border-slate-200 bg-surface-tertiary',
}

const highlightClasses = {
  fail: 'border-l-4 border-l-status-fail',
  pass: 'border-l-4 border-l-status-pass',
  warn: 'border-l-4 border-l-status-warn',
}

const wrapperClasses = computed(() => {
  if (props.turn.role === 'agent') {
    return 'justify-end'
  }

  if (props.turn.role === 'action') {
    return 'justify-center'
  }

  return 'justify-start'
})

const bubbleClasses = computed(() => {
  const roleClass = bubbleToneClasses[props.turn.role] || bubbleToneClasses.user
  const activeClass = props.highlighted ? highlightClasses[props.tone] || highlightClasses.warn : ''
  return `${roleClass} ${activeClass}`.trim()
})

const speakerLabel = computed(() => {
  if (props.turn.role === 'agent') {
    return 'Agent'
  }

  if (props.turn.role === 'action') {
    return 'Action'
  }

  return 'User'
})

const timestamp = computed(() => formatTurnTime(props.turn.startTime))
const fallbackContent = computed(() => {
  if (props.turn.role !== 'action') {
    return 'No transcript content available.'
  }

  return 'Action executed.'
})
</script>
