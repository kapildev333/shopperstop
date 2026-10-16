import { execFileSync } from 'node:child_process'
import path from 'node:path'

const core = 'http://localhost:18080/api/core/v1'
const koramangala = '00000000-0000-4000-8000-000000000401'
const indiranagar = '00000000-0000-4000-8000-000000000402'

// Core's answer as JSON; a non-200 names the URL, so a dead core fails the run here and not inside a spec.
async function getJson(url: string): Promise<unknown> {
  const answer = await fetch(url)
  if (answer.status !== 200) throw new Error(`e2e: GET ${url} answered ${answer.status}, not 200`)
  return answer.json()
}

// Starts the mobile suite from a fresh demo customer; make e2e runs the same two commands before every suite.
export default async function globalSetup() {
  // seed-demo --reset wipes the database it points at: refuse anything but an _e2e database.
  const database = process.env.SHOPPERSTOP_CORE_DATABASE_URL
  if (!database || !new URL(database).pathname.endsWith('_e2e')) {
    throw new Error('e2e: set SHOPPERSTOP_CORE_DATABASE_URL to an _e2e database (make e2e sets it); refusing to reset another database')
  }
  const cwd = path.resolve(__dirname, '../../../services/core')
  execFileSync('go', ['run', './cmd/core-admin', 'migrate'], { cwd, stdio: 'inherit' })
  execFileSync('go', ['run', './cmd/core-admin', 'seed-demo', '--reset'], { cwd, stdio: 'inherit' })

  // The picks are read once, after the reseed; the specs' workers inherit the variable and never ask core for them again.
  const { minOrderCents } = (await getJson(`${core}/stores/${koramangala}`)) as { minOrderCents: number }
  const page2 = ((await getJson(`${core}/stores/${koramangala}/products?page=2&pageSize=100`)) as { items: unknown[] }).items
  const home: Record<string, unknown[]> = {}
  for (const storeId of [koramangala, indiranagar]) {
    home[storeId] = ((await getJson(`${core}/stores/${storeId}/products?pageSize=24`)) as { items: unknown[] }).items
  }
  process.env.SHOPPERSTOP_MOBILE_E2E_PICKS = JSON.stringify({ minOrderCents, page2, home })
}
