import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Starts the web suite from a fresh demo customer; make e2e runs the same two commands before every suite.
export default function globalSetup() {
  const cwd = fileURLToPath(new URL('../../../services/core', import.meta.url))
  execFileSync('go', ['run', './cmd/core-admin', 'migrate'], { cwd, stdio: 'inherit' })
  execFileSync('go', ['run', './cmd/core-admin', 'seed-demo', '--reset'], { cwd, stdio: 'inherit' })
}
