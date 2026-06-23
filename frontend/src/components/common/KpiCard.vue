<script setup>
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '—' },
  sub: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
  tone: { type: String, default: 'default' },
  accent: { type: String, default: '' },
})

const TONE_CLASSES = {
  default: 'text-foreground',
  positive: 'text-emerald-600',
  warning: 'text-amber-600',
  negative: 'text-rose-600',
}
</script>

<template>
  <Card class="gap-0 py-0">
    <CardContent class="flex items-start justify-between gap-3 p-5">
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {{ label }}
        </p>
        <p :class="cn('mt-2 text-2xl font-semibold tabular-nums', TONE_CLASSES[tone] || TONE_CLASSES.default)">
          {{ value }}
        </p>
        <p
          v-if="sub"
          class="mt-1 truncate text-xs text-muted-foreground"
        >
          {{ sub }}
        </p>
      </div>
      <span
        v-if="icon"
        :class="cn('flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground', accent)"
      >
        <component
          :is="icon"
          class="size-4.5"
        />
      </span>
    </CardContent>
  </Card>
</template>
