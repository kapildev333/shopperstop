// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(here, '..', '..', 'package.json'), 'utf8')) as {
  exports: Record<string, unknown>
  peerDependencies: Record<string, string>
  devDependencies: Record<string, string>
}

test('package exports the app entry', () => {
  expect(pkg.exports['./app']).toEqual({ types: './dist/app/index.d.ts', default: './dist/app/index.js' })
  expect(pkg.peerDependencies['openapi-fetch']).toBe('0.17.0')
  expect(pkg.devDependencies['openapi-fetch']).toBe('0.17.0')
  expect(pkg.exports['.']).toEqual({ types: './dist/index.d.ts', default: './dist/index.js' })
  expect(pkg.exports['./format']).toEqual({ types: './dist/format.d.ts', default: './dist/format.js' })
  expect(pkg.exports['./tokens']).toEqual({ types: './dist/tokens.d.ts', default: './dist/tokens.js' })
})
