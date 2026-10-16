import { defineConfig, devices } from '@playwright/test'

const reuseExistingServer = !process.env.CI

// The web export on 15176 talks to core on 18080 (the e2e script bakes that URL in). make e2e seeds both databases first.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  forbidOnly: !!process.env.CI,
  use: { baseURL: 'http://localhost:15176/' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }],
  webServer: [
    {
      command: 'go run ./cmd/core',
      cwd: '../../services/core',
      url: 'http://localhost:18080/api/core/v1/healthz',
      reuseExistingServer,
      timeout: 120_000,
    },
    // Serves dist-e2e, written by the e2e script's export; a standalone run needs `npm run e2e` (the export) first.
    { command: 'npx expo serve dist-e2e --port 15176', url: 'http://localhost:15176/', reuseExistingServer },
  ],
})
