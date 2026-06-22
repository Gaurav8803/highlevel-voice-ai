import { createRouter, createWebHistory } from 'vue-router'

import AgentDetailView from '../views/AgentDetailView.vue'
import CallDetailView from '../views/CallDetailView.vue'
import DashboardView from '../views/DashboardView.vue'

function resolveRouterBase() {
  if (typeof window !== 'undefined' && window.__VOICE_AI_EMBED__?.routerBase) {
    return window.__VOICE_AI_EMBED__.routerBase
  }

  return import.meta.env.BASE_URL
}

const router = createRouter({
  history: createWebHistory(resolveRouterBase()),
  scrollBehavior(to) {
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
      }
    }

    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
    },
    {
      path: '/agents/:id',
      name: 'agent-detail',
      component: AgentDetailView,
    },
    {
      path: '/calls/:id',
      name: 'call-detail',
      component: CallDetailView,
    },
  ],
})

export default router
