// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, expectTypeOf, it } from 'vitest'
import type { components, paths } from '@shopperstop/ui/api'

const require = createRequire(import.meta.url)
const cli = join(dirname(require.resolve('openapi-typescript/package.json')), 'bin', 'cli.js')
const contract = fileURLToPath(new URL('../../../../services/core/openapi.json', import.meta.url))
const committed = fileURLToPath(new URL('./core.d.ts', import.meta.url))

it('generated types match the contract', () => {
  const result = spawnSync(process.execPath, [cli, contract], { encoding: 'utf8' })
  expect(result.status).toBe(0)
  expect(result.stdout).toBe(readFileSync(committed, 'utf8'))
})

it('response types are usable by name', () => {
  expectTypeOf<paths['/readyz']['get']['responses'][200]['content']['application/json']>().toEqualTypeOf<{
    status: 'ok'
  }>()
  expectTypeOf<components['schemas']['Error']['error']['code']>().toEqualTypeOf<
    | 'validation'
    | 'unauthorized'
    | 'forbidden'
    | 'not_found'
    | 'conflict'
    | 'out_of_stock'
    | 'not_serviceable'
    | 'rate_limited'
    | 'internal'
  >()
})
