import { defineConfig, devices } from '@playwright/test'

const reuseExistingServer = !process.env.CI

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  forbidOnly: !!process.env.CI,
  use: { baseURL: 'http://localhost:15173/' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'go run ./cmd/core',
      cwd: '../../services/core',
      url: 'http://localhost:18080/api/core/v1/healthz',
      reuseExistingServer,
      timeout: 120_000,
    },
    { command: 'vite preview', url: 'http://localhost:15173/', reuseExistingServer },
  ],
})
