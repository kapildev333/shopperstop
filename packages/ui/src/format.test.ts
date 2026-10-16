// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { formatInr } from './format'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(here, 'format.ts'), 'utf8')

test('formatInr imports nothing', () => {
  expect(source).not.toMatch(/^\s*import\s/m)
  expect(formatInr(123400)).toBe('₹1,234')
  expect(formatInr(123450)).toBe('₹1,234.50')
  expect(formatInr(0)).toBe('₹0')
})
