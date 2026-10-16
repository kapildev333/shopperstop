/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/admin/',
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  // The rider service first: Vite proxies with the first key that matches.
  server: { port: 5174, strictPort: true, proxy: { '/api/rider': 'http://localhost:8081', '/api': 'http://localhost:8080' } },
  preview: { port: 15174, strictPort: true, proxy: { '/api/rider': 'http://localhost:18081', '/api': 'http://localhost:18080' } },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
})
