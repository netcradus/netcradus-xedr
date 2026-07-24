import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// The app calls the backend via relative /api/v1 paths (see src/api/client.ts)
// so it works unmodified behind nginx in production. In dev, Vite's own
// server proxies those same paths to the local backend — override the
// target with VITE_BACKEND_URL if your backend isn't on the default port.
const backendTarget = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8888'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': { target: backendTarget, changeOrigin: true },
      '/health': { target: backendTarget, changeOrigin: true },
    },
  },
})
