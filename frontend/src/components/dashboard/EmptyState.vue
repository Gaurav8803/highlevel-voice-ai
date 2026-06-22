<template>
  <div class="rounded-lg border border-dashed border-border bg-white px-6 py-12 text-center shadow-card">
    <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-primary">
      <span class="text-lg font-semibold">AI</span>
    </div>
    <h3 class="mt-4 text-lg font-semibold text-content-primary">
      {{ title }}
    </h3>
    <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-content-secondary">
      {{ description }}
    </p>
    <button
      v-if="actionLabel"
      class="mt-5 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
      type="button"
      @click="$emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>

<script setup>
defineEmits(['action'])

defineProps({
  actionLabel: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
})
</script>
