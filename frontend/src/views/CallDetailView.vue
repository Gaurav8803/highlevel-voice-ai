<template>
  <section class="space-y-6">
    <header class="rounded-3xl border border-white/10 bg-white/5 p-8">
      <p class="text-sm font-medium uppercase tracking-[0.3em] text-sky-300/80">
        Call Detail
      </p>
      <h1 class="mt-3 text-3xl font-semibold tracking-tight text-white">
        Call {{ route.params.id }}
      </h1>
      <p class="mt-4 max-w-2xl text-sm leading-7 text-stone-300">
        Placeholder view for transcript evidence, deterministic checks, and semantic evaluation results.
      </p>
    </header>
  </section>
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()
</script>
