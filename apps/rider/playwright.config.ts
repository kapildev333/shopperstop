import { defineConfig, devices } from '@playwright/test'

const reuseExistingServer = !process.env.CI

// make e2e builds every app and gives the environment; the previews below serve those dist folders.
// A standalone run (npm run e2e --workspace apps/rider) needs `npm run build` for apps/rider, apps/web and apps/admin first.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  forbidOnly: !!process.env.CI,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:15175/rider/',
        viewport: { width: 390, height: 844 },
        geolocation: { latitude: 12.9352, longitude: 77.6245 },
        permissions: ['geolocation'],
      },
    },
  ],
  webServer: [
    {
      command: 'go run ./cmd/core',
      cwd: '../../services/core',
      url: 'http://localhost:18080/api/core/v1/healthz',
      reuseExistingServer,
      timeout: 120_000,
    },
    {
      command: 'go run ./cmd/rider',
      cwd: '../../services/rider',
      url: 'http://localhost:18081/api/rider/v1/healthz',
      reuseExistingServer,
      timeout: 120_000,
    },
    { command: 'vite preview', url: 'http://localhost:15175/rider/', reuseExistingServer },
    // The cross-app flow (e2e/flow.spec.ts) drives the customer site and the admin app too.
    { command: 'npx vite preview', cwd: '../web', url: 'http://localhost:15173/', reuseExistingServer },
    { command: 'npx vite preview', cwd: '../admin', url: 'http://localhost:15174/admin/', reuseExistingServer },
  ],
})
