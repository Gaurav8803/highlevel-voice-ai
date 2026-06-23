import { createRouter, createWebHistory } from 'vue-router'

import DashboardView from '../views/DashboardView.vue'

const AgentDetailView = () => import('../views/AgentDetailView.vue')
const CallDetailView = () => import('../views/CallDetailView.vue')

function resolveRouterBase() {
  if (typeof window !== 'undefined' && window.__VOICE_AI_EMBED__?.routerBase) {
    return window.__VOICE_AI_EMBED__.routerBase
  }

  return import.meta.env.BASE_URL
}

const router = createRouter({
  history: createWebHistory(resolveRouterBase()),
  scrollBehavior(to) {
    if (to.hash && typeof document !== 'undefined' && document.querySelector(to.hash)) {
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
