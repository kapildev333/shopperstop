import { execFileSync } from 'node:child_process'
import path from 'node:path'

// Starts the mobile suite from a fresh demo customer; make e2e runs the same two commands before every suite.
export default function globalSetup() {
  // seed-demo --reset wipes the database it points at: refuse anything but an _e2e database.
  const database = process.env.SHOPPERSTOP_CORE_DATABASE_URL
  if (!database || !new URL(database).pathname.endsWith('_e2e')) {
    throw new Error('e2e: set SHOPPERSTOP_CORE_DATABASE_URL to an _e2e database (make e2e sets it); refusing to reset another database')
  }
  const cwd = path.resolve(__dirname, '../../../services/core')
  execFileSync('go', ['run', './cmd/core-admin', 'migrate'], { cwd, stdio: 'inherit' })
  execFileSync('go', ['run', './cmd/core-admin', 'seed-demo', '--reset'], { cwd, stdio: 'inherit' })
}
