import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const core = fileURLToPath(new URL('../../../services/core', import.meta.url))

// Self-contained suite (D22): migrate and reset the demo seed with the environment Playwright was given.
export default function globalSetup() {
  for (const args of [['migrate'], ['seed-demo', '--reset']]) {
    execFileSync('go', ['run', './cmd/core-admin', ...args], { cwd: core, stdio: 'inherit' })
  }
}
