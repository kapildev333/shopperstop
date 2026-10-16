import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Self-contained suite (D22): both services migrate and reset their demo seed with the environment Playwright was given.
export default function globalSetup() {
  // seed-demo --reset wipes the database it points at: refuse anything but an _e2e database.
  for (const variable of ['SHOPPERSTOP_CORE_DATABASE_URL', 'SHOPPERSTOP_RIDER_DATABASE_URL']) {
    const database = process.env[variable]
    if (!database || !new URL(database).pathname.endsWith('_e2e')) {
      throw new Error(`e2e: set ${variable} to an _e2e database (make e2e sets it); refusing to reset another database`)
    }
  }
  for (const [service, admin] of [
    ['core', 'core-admin'],
    ['rider', 'rider-admin'],
  ] as const) {
    const cwd = fileURLToPath(new URL(`../../../services/${service}`, import.meta.url))
    for (const args of [['migrate'], ['seed-demo', '--reset']]) {
      execFileSync('go', ['run', `./cmd/${admin}`, ...args], { cwd, stdio: 'inherit' })
    }
  }
}
