<template>
  <section class="space-y-8">
    <div class="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20">
      <p class="text-sm font-medium uppercase tracking-[0.3em] text-amber-300/80">
        Dashboard
      </p>
      <h1 class="mt-3 text-4xl font-semibold tracking-tight text-white">
        Observability overview
      </h1>
      <p class="mt-4 max-w-2xl text-sm leading-7 text-stone-300">
        This scaffold is ready for agent ingestion, call evaluations, and evidence-backed findings.
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <article
        v-for="card in cards"
        :key="card.label"
        class="rounded-3xl border border-white/10 bg-black/20 p-6"
      >
        <p class="text-sm text-stone-400">{{ card.label }}</p>
        <p class="mt-3 text-3xl font-semibold text-white">{{ card.value }}</p>
      </article>
    </div>
  </section>
</template>

<script setup>
const cards = [
  { label: 'Agents tracked', value: '0' },
  { label: 'Calls evaluated', value: '0' },
  { label: 'Findings surfaced', value: '0' },
]
</script>
