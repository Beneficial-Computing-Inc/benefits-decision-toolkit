import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      // Allow serving files from the BDT codebase
      allow: ['..'],
    },
    proxy: {
      // Proxy API requests to library-api to avoid CORS issues
      '/api': {
        target: 'http://localhost:8083',
        changeOrigin: true,
        secure: false,
      },
      // Proxy OpenAPI spec requests
      '/q/openapi': {
        target: 'http://localhost:8083',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
