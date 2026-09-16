import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/repo': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/api/audits': {
        target: 'http://localhost:3002',
        changeOrigin: true
      },
      '/outputs': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
  }
})
