<script setup>
import { computed } from 'vue'
import { VisArea, VisAxis, VisCrosshair, VisLine, VisScatter, VisXYContainer } from '@unovis/vue'

import { formatShortDate } from '@/utils/formatters.js'

const props = defineProps({
  points: { type: Array, default: () => [] },
})

const CHART_COLOR = '#2563eb'
const Y_TICKS = [0, 20, 40, 60, 80, 100]

const data = computed(() => props.points.map((point, index) => ({
  date: point.date,
  index,
  score: Math.max(0, Math.min(100, point.score ?? 0)),
})))

const x = (d) => d.index
const y = (d) => d.score

function xTickFormat(value) {
  const point = data.value[Math.round(value)]
  return point ? formatShortDate(point.date) : ''
}

function crosshairTemplate(d) {
  return `<div style="font-size:12px;font-weight:600">${Math.round(d.score)}</div><div style="font-size:11px;color:#71717a">${formatShortDate(d.date)}</div>`
}
</script>

<template>
  <VisXYContainer
    :data="data"
    :height="220"
    :y-domain="[0, 100]"
    :margin="{ top: 8, right: 12, bottom: 8, left: 8 }"
  >
    <VisArea
      :x="x"
      :y="y"
      :color="CHART_COLOR"
      :opacity="0.1"
    />
    <VisLine
      :x="x"
      :y="y"
      :color="CHART_COLOR"
      :line-width="2.5"
    />
    <VisScatter
      :x="x"
      :y="y"
      :color="CHART_COLOR"
      :size="5"
    />
    <VisAxis
      type="x"
      :tick-format="xTickFormat"
      :num-ticks="Math.min(data.length, 6)"
      :grid-line="false"
    />
    <VisAxis
      type="y"
      :tick-values="Y_TICKS"
    />
    <VisCrosshair
      :template="crosshairTemplate"
      :color="CHART_COLOR"
    />
  </VisXYContainer>
</template>
