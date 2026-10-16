import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Starts the web suite from a fresh demo customer and a fresh demo rider; make e2e runs the same commands before every suite.
export default function globalSetup() {
  // seed-demo --reset wipes the database it points at: refuse anything but an _e2e database.
  const database = process.env.SHOPPERSTOP_CORE_DATABASE_URL
  if (!database || !new URL(database).pathname.endsWith('_e2e')) {
    throw new Error('e2e: set SHOPPERSTOP_CORE_DATABASE_URL to an _e2e database (make e2e sets it); refusing to reset another database')
  }
  const riderDatabase = process.env.SHOPPERSTOP_RIDER_DATABASE_URL
  if (!riderDatabase || !new URL(riderDatabase).pathname.endsWith('_e2e')) {
    throw new Error('e2e: set SHOPPERSTOP_RIDER_DATABASE_URL to an _e2e database (make e2e sets it); refusing to reset another database')
  }
  const cwd = fileURLToPath(new URL('../../../services/core', import.meta.url))
  execFileSync('go', ['run', './cmd/core-admin', 'migrate'], { cwd, stdio: 'inherit' })
  execFileSync('go', ['run', './cmd/core-admin', 'seed-demo', '--reset'], { cwd, stdio: 'inherit' })
  const riderCwd = fileURLToPath(new URL('../../../services/rider', import.meta.url))
  execFileSync('go', ['run', './cmd/rider-admin', 'migrate'], { cwd: riderCwd, stdio: 'inherit' })
  execFileSync('go', ['run', './cmd/rider-admin', 'seed-demo', '--reset'], { cwd: riderCwd, stdio: 'inherit' })
}
