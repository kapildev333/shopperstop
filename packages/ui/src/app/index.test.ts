// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import * as app from './index'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(here, 'index.ts'), 'utf8')

test('entry exports the shared helpers', () => {
  expect(typeof app.createTokenStore).toBe('function')
  expect(typeof app.createApiClient).toBe('function')
  expect(typeof app.since).toBe('function')
  expect(typeof app.useSince).toBe('function')
  expect(typeof app.when).toBe('function')
  expect(source).not.toMatch(/^\s*import\s.*\.css/m)
})
