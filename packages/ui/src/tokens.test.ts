import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'tailwindcss'
import { expect, test } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const req = createRequire(import.meta.url)
const tokensCss = readFileSync(resolve(here, 'tokens.css'), 'utf8')
const indexTs = readFileSync(resolve(here, 'index.ts'), 'utf8')

// Spec 1 section 8.1 values; line-strong is #868C94 (PLAN.md D12).
const palette: Record<string, string> = {
  brand: '#F8CB46',
  'brand-strong': '#E5B51F',
  'on-brand': '#1F1F1F',
  accent: '#0C831F',
  'accent-hover': '#0A6B19',
  'accent-soft': '#E8F5EA',
  'on-accent': '#FFFFFF',
  canvas: '#F5F6F8',
  surface: '#FFFFFF',
  line: '#E6E8EB',
  'line-strong': '#868C94',
  ink: '#1F1F1F',
  'ink-muted': '#6B7280',
  focus: '#2563EB',
  danger: '#D92D20',
  'danger-soft': '#FEE4E2',
  warning: '#B54708',
  'warning-soft': '#FEF0C7',
  success: '#0C831F',
  'success-soft': '#E8F5EA',
}

async function build(candidates: string[]): Promise<string> {
  const c = await compile('@import "tailwindcss"; @import "./tokens.css";', {
    base: here,
    loadStylesheet: async (id: string, base: string) => {
      const path = id === 'tailwindcss' ? req.resolve('tailwindcss/index.css') : resolve(base, id)
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') }
    },
  })
  return c.build(candidates)
}

function rootValues(): Record<string, string> {
  const root = /:root\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? ''
  const values: Record<string, string> = {}
  for (const m of root.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    values[m[1]] = m[2].toUpperCase()
  }
  return values
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test('token values match the palette', () => {
  const expected = Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, v.toUpperCase()]))
  expect(rootValues()).toEqual(expected)
})

test('semantic utilities compile', async () => {
  const names = [
    'bg-brand',
    'text-ink',
    'border-line-strong',
    'shadow-card',
    'shadow-sheet',
    'rounded-control',
    'rounded-card',
    'text-display',
  ]
  const css = await build(names)
  for (const name of names) {
    expect(css, name).toMatch(new RegExp(`\\.${name}\\s*\\{`))
  }
  expect(css).toMatch(/--text-display:\s*28px/)
  expect(css).toMatch(/--text-display--line-height:\s*34px/)
  expect(css).toMatch(/--text-display--font-weight:\s*700/)
})

test('default palette and shadows are off', async () => {
  const css = await build(['bg-gray-100', 'text-red-500', 'bg-white', 'text-black', 'shadow-md'])
  for (const name of ['bg-gray-100', 'text-red-500', 'bg-white', 'text-black', 'shadow-md']) {
    expect(css, name).not.toMatch(new RegExp(`\\.${name}\\s*\\{`))
  }
})

test('font comes from the package', () => {
  expect(indexTs).toContain("import '@fontsource-variable/inter'")
  expect(tokensCss).toMatch(/--font-sans:\s*"Inter Variable"/)
  expect(indexTs).not.toContain('http')
  expect(tokensCss).not.toContain('http')
})

test('reduced motion turns transitions off', async () => {
  const css = await build(['transition-colors'])
  expect(css).toMatch(/--default-transition-duration:\s*150ms/)
  expect(css).toMatch(/--default-transition-timing-function:\s*ease-out/)
  expect(css).toMatch(/\.transition-colors\s*\{[^}]*var\(--default-transition-duration\)/)
  expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*transition-duration:\s*0s/)
  expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*animation-duration:\s*0s/)
})

test('focus ring uses the focus token', async () => {
  const css = await build([])
  expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus\)/)
})

test('used pairs pass', () => {
  const values = rootValues()
  const pairs: [string, string][] = [
    ['ink', 'surface'],
    ['ink', 'canvas'],
    ['ink-muted', 'surface'],
    ['accent', 'surface'],
    ['accent', 'canvas'],
    ['on-accent', 'accent'],
    ['on-accent', 'accent-hover'],
    ['on-brand', 'brand'],
    ['danger', 'surface'],
    ['accent-hover', 'accent-soft'],
    ['ink', 'accent-soft'],
    ['ink', 'danger-soft'],
    ['ink', 'warning-soft'],
    ['ink', 'success-soft'],
  ]
  for (const [fg, bg] of pairs) {
    expect(contrast(values[fg], values[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
  }
  expect(contrast(values['line-strong'], values.surface), 'line-strong on surface').toBeGreaterThanOrEqual(3)
})
