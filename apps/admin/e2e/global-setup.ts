import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const core = fileURLToPath(new URL('../../../services/core', import.meta.url))
const rider = fileURLToPath(new URL('../../../services/rider', import.meta.url))

// Self-contained suite (D22): migrate and reset both demo seeds with the environment Playwright was given. The rider
// seed calls no core, so the order does not matter.
export default function globalSetup() {
  for (const [cwd, command] of [[core, './cmd/core-admin'], [rider, './cmd/rider-admin']]) {
    for (const args of [['migrate'], ['seed-demo', '--reset']]) {
      execFileSync('go', ['run', command, ...args], { cwd, stdio: 'inherit' })
    }
  }
}
