// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const script = join(here, 'check-figma-tokens.mjs')
const css = join(here, '..', 'src', 'tokens.css')
const fixture = (name: string) => join(here, 'fixtures', name)

function run(...args: string[]) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
}

test('matching export', () => {
  const result = run(fixture('figma-tokens-match.json'), css)
  expect(result.status).toBe(0)
  expect(result.stdout.trim()).toBe('figma tokens match tokens.css (20 colours)')
})

test('drifted export', () => {
  const result = run(fixture('figma-tokens-drift.json'), css)
  expect(result.status).toBe(1)
  expect(result.stdout.trim().split('\n')).toEqual([
    'mismatch brand: css #F8CB46, figma #F8CB47',
    'missing in figma: focus',
    'missing in css: teal',
  ])
})

test('usage error', () => {
  const none = run()
  expect(none.status).toBe(2)
  expect(none.stderr).toContain('usage: node scripts/check-figma-tokens.mjs')

  const unreadable = run(join(here, 'fixtures', 'does-not-exist.json'), css)
  expect(unreadable.status).toBe(2)
  expect(unreadable.stderr).toContain('usage: node scripts/check-figma-tokens.mjs')
})
