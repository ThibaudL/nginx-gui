import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 8881,
    proxy: {
      '/api': 'http://localhost:9004'
    }
  },
  build: {
    outDir: '../public',
    emptyOutDir: true
  }
})
