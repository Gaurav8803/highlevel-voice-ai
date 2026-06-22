<template>
  <aside class="hidden w-72 border-r border-white/10 bg-black/20 px-6 py-8 backdrop-blur lg:block">
    <div class="space-y-8">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.35em] text-amber-300/80">
          HighLevel
        </p>
        <h1 class="mt-3 text-2xl font-semibold tracking-tight text-white">
          Voice AI Copilot
        </h1>
        <p class="mt-3 text-sm leading-6 text-stone-400">
          Observe agents, inspect calls, and prepare evidence-backed evaluations.
        </p>
      </div>

      <nav class="space-y-2">
        <RouterLink
          class="block rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-stone-200 transition hover:border-amber-300/40 hover:bg-white/5"
          to="/"
        >
          Dashboard
        </RouterLink>
        <RouterLink
          class="block rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-stone-200 transition hover:border-amber-300/40 hover:bg-white/5"
          to="/agents/demo-agent"
        >
          Agent Detail
        </RouterLink>
        <RouterLink
          class="block rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-stone-200 transition hover:border-amber-300/40 hover:bg-white/5"
          to="/calls/demo-call"
        >
          Call Detail
        </RouterLink>
      </nav>
    </div>
  </aside>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>
