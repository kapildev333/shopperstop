// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expect, test } from 'vitest'
import { colors, motion, radius, shadows, spacing, type } from '../src/tokens'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
  exports: Record<string, unknown>
  scripts: Record<string, string>
}
const { generateTokens } = (await import(pathToFileURL(join(here, 'gen-tokens.mjs')).href)) as {
  generateTokens: (css: string) => string
}
const css = readFileSync(join(here, '..', 'src', 'tokens.css'), 'utf8')
const committed = readFileSync(join(here, '..', 'src', 'tokens.ts'), 'utf8')

test('generated tokens match tokens.css', () => {
  expect(generateTokens(css)).toBe(committed)
})

test('a drifted tokens.css fails the check', () => {
  const drifted = css.replace('--brand: #F8CB46;', '--brand: #F8CB47;')
  expect(drifted).not.toBe(css)
  const out = generateTokens(drifted)
  expect(out).not.toBe(committed)
  expect(out).toContain('"brand": "#F8CB47"')
})

test('package exports tokens and format', () => {
  expect(pkg.exports['./tokens']).toEqual({ types: './dist/tokens.d.ts', default: './dist/tokens.js' })
  expect(pkg.exports['./format']).toEqual({ types: './dist/format.d.ts', default: './dist/format.js' })
  expect(pkg.scripts['gen:tokens']).toBe('node scripts/gen-tokens.mjs')
})

test('every colour token is exported by camelCase name', () => {
  expect(Object.keys(colors).sort()).toEqual(
    [
      'accent', 'accentHover', 'accentSoft', 'brand', 'brandStrong', 'canvas', 'danger', 'dangerSoft',
      'focus', 'ink', 'inkMuted', 'line', 'lineStrong', 'onAccent', 'onBrand', 'success', 'successSoft',
      'surface', 'warning', 'warningSoft',
    ].sort(),
  )
  expect(colors.brand).toBe('#F8CB46')
  expect(colors.brandStrong).toBe('#E5B51F')
  expect(colors.lineStrong).toBe('#868C94')
})

test('scale values are numbers in px and ms', () => {
  expect(type.display).toEqual({ size: 28, lineHeight: 34, weight: 700 })
  expect(type.h3).toEqual({ size: 16, lineHeight: 22, weight: 600 })
  expect(type.body).toEqual({ size: 14, lineHeight: 20, weight: 400 })
  expect(radius).toEqual({ control: 8, card: 12, pill: 9999 })
  expect(spacing).toEqual({ unit: 4, gutter: 16, gridGap: 12 })
  expect(motion).toEqual({ duration: 150, sheetDuration: 200, easing: 'ease-out' })
})

test('shadows carry offsets, blur, colour and opacity', () => {
  expect(shadows.card).toEqual({
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
    offsetX: 0,
    offsetY: 1,
    blur: 3,
    color: '#000000',
    opacity: 0.08,
  })
  expect(shadows.sheet).toEqual({
    boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.12)',
    offsetX: 0,
    offsetY: -4,
    blur: 16,
    color: '#000000',
    opacity: 0.12,
  })
})
