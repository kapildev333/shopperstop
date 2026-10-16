import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import { coreLog } from './e2e/mail'

// Core's stdout goes to coreLog, emptied at each start: the account-security e2e reads the mails core logs there.
mkdirSync(dirname(coreLog), { recursive: true })

const reuseExistingServer = !process.env.CI

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  forbidOnly: !!process.env.CI,
  use: { baseURL: 'http://localhost:15173/' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `go run ./cmd/core > ${JSON.stringify(coreLog)}`,
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
    { command: 'vite preview', url: 'http://localhost:15173/', reuseExistingServer },
    // The cross-app flows (e2e/flows.spec.ts) drive the admin app too: its build, as `make e2e` made it, served as admin's own config does.
    // Serves apps/admin/dist, built by make e2e; a standalone web run needs `npm run build --workspace apps/admin` first.
    { command: 'npx vite preview', cwd: '../admin', url: 'http://localhost:15174/admin/', reuseExistingServer },
  ],
})
