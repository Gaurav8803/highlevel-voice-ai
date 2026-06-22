<template>
  <div class="flex min-w-0 flex-1 flex-col gap-1 px-1 py-2">
    <div
      :class="valueClasses"
      class="text-3xl font-semibold tracking-tight"
    >
      {{ value }}
    </div>
    <div class="text-sm text-content-secondary">
      {{ label }}
    </div>
    <div
      v-if="hint"
      class="text-xs text-content-tertiary"
    >
      {{ hint }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  hint: {
    type: String,
    default: '',
  },
  label: {
    type: String,
    required: true,
  },
  tone: {
    type: String,
    default: 'neutral',
  },
  value: {
    type: String,
    required: true,
  },
})

const valueToneClasses = {
  fail: 'text-status-fail',
  neutral: 'text-content-primary',
  pass: 'text-status-pass',
  warn: 'text-status-warn',
}

const valueClasses = computed(() => valueToneClasses[props.tone] || valueToneClasses.neutral)
</script>
