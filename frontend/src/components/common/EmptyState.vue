<script setup>
import { Inbox } from '@lucide/vue'

import { Button } from '@/components/ui/button'

defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
})

defineEmits(['action'])
</script>

<template>
  <div class="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-12 text-center">
    <component
      :is="icon || Inbox"
      class="size-8 text-muted-foreground/50"
    />
    <h3 class="mt-4 text-sm font-semibold text-foreground">
      {{ title }}
    </h3>
    <p
      v-if="description"
      class="mt-1 max-w-sm text-sm text-muted-foreground"
    >
      {{ description }}
    </p>
    <Button
      v-if="actionLabel"
      class="mt-4"
      size="sm"
      @click="$emit('action')"
    >
      {{ actionLabel }}
    </Button>
  </div>
</template>
