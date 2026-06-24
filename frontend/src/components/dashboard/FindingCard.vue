<script setup>
import { computed } from 'vue'
import { CornerDownRight, Quote } from '@lucide/vue'

import { cn } from '@/lib/utils'
import CategoryBadge from '@/components/common/CategoryBadge.vue'
import EvidenceStrengthChip from '@/components/common/EvidenceStrengthChip.vue'
import SeverityBadge from '@/components/common/SeverityBadge.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'

const props = defineProps({
  finding: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

defineEmits(['select'])

const quotes = computed(() => (Array.isArray(props.finding.evidence?.quotes) ? props.finding.evidence.quotes : []))
const reasoning = computed(() => props.finding.evidence?.reasoning || '')
const turnIndices = computed(() => (Array.isArray(props.finding.evidence?.turnIndices) ? props.finding.evidence.turnIndices : []))
const recommendation = computed(() => props.finding.recommendation || '')
</script>

<template>
  <button
    type="button"
    :class="cn(
      'w-full rounded-lg border bg-card p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      selected ? 'border-blue-400 ring-1 ring-blue-400' : 'border-border hover:border-zinc-300',
    )"
    @click="$emit('select', finding)"
  >
    <div class="flex items-start gap-2.5">
      <StatusIcon
        :status="finding.status"
        class="mt-0.5"
      />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium leading-snug text-foreground">
          {{ finding.label }}
        </p>
        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
          <CategoryBadge :category="finding.category" />
          <SeverityBadge :severity="finding.severity" />
          <EvidenceStrengthChip :strength="finding.evidenceStrength" />
          <span
            v-if="turnIndices.length"
            class="text-[11px] text-muted-foreground"
          >turns {{ turnIndices.join(', ') }}</span>
        </div>
      </div>
    </div>

    <div
      v-if="selected"
      class="mt-3 space-y-2 border-t pt-3"
    >
      <p
        v-if="reasoning"
        class="text-sm leading-relaxed text-muted-foreground"
      >
        {{ reasoning }}
      </p>
      <p
        v-for="(quote, index) in quotes"
        :key="index"
        class="flex gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs italic text-foreground"
      >
        <Quote class="mt-0.5 size-3 shrink-0 text-muted-foreground" />
        {{ quote }}
      </p>
      <p
        v-if="recommendation"
        class="flex gap-1.5 text-xs text-foreground"
      >
        <CornerDownRight class="mt-0.5 size-3.5 shrink-0 text-blue-600" />
        <span>{{ recommendation }}</span>
      </p>
    </div>
  </button>
</template>
