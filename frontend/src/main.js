import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'

import App from './App.vue'
import router from './router/index.js'
import 'vue-sonner/style.css'
import './style.css'

const queryClientConfig = {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 30_000,
      },
    },
  },
}

createApp(App).use(router).use(VueQueryPlugin, queryClientConfig).mount('#app')
