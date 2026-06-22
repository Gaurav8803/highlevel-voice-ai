import { createRouter, createWebHistory } from 'vue-router'

import AgentDetailView from '../views/AgentDetailView.vue'
import CallDetailView from '../views/CallDetailView.vue'
import DashboardView from '../views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(),
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
