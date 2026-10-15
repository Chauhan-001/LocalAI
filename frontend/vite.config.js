import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The backend serves the API on 3002. Proxying keeps the browser on a single
// origin, so requests are same-origin and no CORS preflight is involved.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: false
      }
    }
  },
  preview: {
    port: 4173,
    strictPort: true
  }
})
