/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  // '/api/rider' first: Vite takes the first key that matches.
  server: { port: 5173, strictPort: true, proxy: { '/api/rider': 'http://localhost:8081', '/api': 'http://localhost:8080' } },
  preview: { port: 15173, strictPort: true, proxy: { '/api/rider': 'http://localhost:18081', '/api': 'http://localhost:18080' } },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
})
