<template>
  <div class="min-h-screen bg-stone-950 text-stone-100">
    <div class="mx-auto flex min-h-screen max-w-7xl">
      <AppSidebar />
      <div class="flex min-h-screen flex-1 flex-col">
        <AppHeader />
        <main class="flex-1 px-6 py-8 sm:px-8 lg:px-10">
          <RouterView />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { RouterView } from 'vue-router'

import AppHeader from './components/layout/AppHeader.vue'
import AppSidebar from './components/layout/AppSidebar.vue'
</script>
