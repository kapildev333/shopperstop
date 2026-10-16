// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, copyFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, expectTypeOf, it } from 'vitest'
import type { components, paths } from '@shopperstop/ui/api'
import type { components as RiderComponents, paths as RiderPaths } from '@shopperstop/ui/api/rider'

const require = createRequire(import.meta.url)
const cli = join(dirname(require.resolve('openapi-typescript/package.json')), 'bin', 'cli.js')
const bin = join(dirname(require.resolve('openapi-typescript/package.json')), '..', '.bin')
const uiRoot = fileURLToPath(new URL('../../', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url))

it.each(['core', 'rider'])('generated %s types match the contract', (name) => {
  const contract = join(repoRoot, 'services', name, 'openapi.json')
  const committed = fileURLToPath(new URL(`./${name}.d.ts`, import.meta.url))
  const result = spawnSync(process.execPath, [cli, contract], { encoding: 'utf8' })
  expect(result.status).toBe(0)
  expect(result.stdout).toBe(readFileSync(committed, 'utf8'))
})

it('gen:api skips an absent rider contract', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gen-api-'))
  try {
    const pkg = join(tmp, 'packages', 'ui')
    mkdirSync(join(pkg, 'src', 'api'), { recursive: true })
    mkdirSync(join(tmp, 'services', 'core'), { recursive: true })
    copyFileSync(join(repoRoot, 'services', 'core', 'openapi.json'), join(tmp, 'services', 'core', 'openapi.json'))
    const script = JSON.parse(readFileSync(join(uiRoot, 'package.json'), 'utf8')).scripts['gen:api']
    const result = spawnSync('sh', ['-c', script], {
      cwd: pkg,
      encoding: 'utf8',
      env: { ...process.env, PATH: bin + delimiter + process.env.PATH },
    })
    expect(result.status).toBe(0)
    expect(result.stdout.split('\n')).toContain('gen:api: services/rider/openapi.json absent, skipping')
    expect(readFileSync(join(pkg, 'src', 'api', 'core.d.ts'), 'utf8')).toBe(
      readFileSync(fileURLToPath(new URL('./core.d.ts', import.meta.url)), 'utf8'),
    )
    expect(existsSync(join(pkg, 'src', 'api', 'rider.d.ts'))).toBe(false)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
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

it('rider response types are usable by name', () => {
  expectTypeOf<RiderPaths['/readyz']['get']['responses'][200]['content']['application/json']>().toEqualTypeOf<{
    status: 'ok'
  }>()
  expectTypeOf<RiderComponents['schemas']['Error']['error']['code']>().toEqualTypeOf<
    | 'validation'
    | 'unauthorized'
    | 'forbidden'
    | 'not_found'
    | 'conflict'
    | 'rate_limited'
    | 'internal'
  >()
})
