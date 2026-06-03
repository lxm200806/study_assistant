import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

const API_PORT = process.env.API_PORT || '3004'

export default defineConfig({
  plugins: [uni()],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // 预编译页面，避免首次进入 tab 时动态 import 超时（WSL 下常见）
    warmup: {
      clientFiles: [
        './src/App.vue',
        './src/pages/**/*.vue'
      ]
    },
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true
      }
    },
    // WSL2 + Windows 浏览器：HMR 与页面使用同一 host:port
    hmr: {
      clientPort: 5173
    },
    watch: {
      usePolling: true
    }
  }
})
