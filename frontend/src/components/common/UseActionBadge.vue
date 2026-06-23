<script setup>
import { computed } from 'vue'
import { MessageSquareText, Wrench } from '@lucide/vue'

import { cn } from '@/lib/utils'

const props = defineProps({
  actionType: { type: String, default: '' },
  withIcon: { type: Boolean, default: true },
})

const ACTION_META = {
  script_training: {
    icon: MessageSquareText,
    label: 'Script training',
    tone: 'bg-violet-100 text-violet-700 ring-violet-600/20',
  },
  workflow_fix: {
    icon: Wrench,
    label: 'Workflow fix',
    tone: 'bg-sky-100 text-sky-700 ring-sky-600/20',
  },
}

const meta = computed(() => ACTION_META[props.actionType] || ACTION_META.workflow_fix)
</script>

<template>
  <span
    :class="cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
      meta.tone,
    )"
  >
    <component
      :is="meta.icon"
      v-if="withIcon"
      class="size-3.5"
    />
    {{ meta.label }}
  </span>
</template>
