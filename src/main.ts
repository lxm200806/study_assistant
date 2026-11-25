import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.config.errorHandler = (error, _instance, info) => {
    console.error('[app] unhandled error:', info, error)
  }
  return {
    app,
    pinia
  }
}
