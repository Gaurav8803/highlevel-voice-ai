<script setup>
import { humanizeCategory } from '@/utils/formatters.js'

defineProps({
  category: { type: String, default: '' },
})
</script>

<template>
  <span
    v-if="category"
    class="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
  >
    {{ humanizeCategory(category) }}
  </span>
</template>
