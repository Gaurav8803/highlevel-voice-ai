<template>
  <span
    :class="dotClasses"
    class="inline-block h-2 w-2 rounded-full"
  />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: String,
    default: 'warn',
  },
})

const classes = {
  fail: 'bg-status-fail',
  pass: 'bg-status-pass',
  warn: 'bg-status-warn',
}

const dotClasses = computed(() => classes[props.status] || classes.warn)
</script>
