/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Core and the rider service share one origin in every environment: the dev server and the preview proxy each service by path.
export default defineConfig({
  base: '/rider/',
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  server: {
    port: 5175,
    strictPort: true,
    proxy: { '/api/core': 'http://localhost:8080', '/api/rider': 'http://localhost:8081' },
  },
  preview: {
    port: 15175,
    strictPort: true,
    proxy: { '/api/core': 'http://localhost:18080', '/api/rider': 'http://localhost:18081' },
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
})
