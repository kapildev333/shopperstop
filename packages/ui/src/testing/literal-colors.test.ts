import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { findLiteralColors, matchLiteralColors } from './literal-colors'

let dir = ''

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = ''
})

test('each literal kind is matched', () => {
  const text =
    '#fff #0C831F bg-gray-100 hover:text-red-500 bg-white text-white border-black ' +
    'rgb(0 0 0) rgba( hsl( oklch( color-mix('
  expect(matchLiteralColors(text)).toEqual([
    '#fff',
    '#0C831F',
    'bg-gray-100',
    'hover:text-red-500',
    'bg-white',
    'text-white',
    'border-black',
    'rgb(',
    'rgba(',
    'hsl(',
    'oklch(',
    'color-mix(',
  ])
})

test('token utilities are not matched', () => {
  expect(
    matchLiteralColors('bg-brand text-on-accent border-line-strong bg-ink/40 text-accent-hover href="#main"'),
  ).toEqual([])
})

test('directory scan names the file', () => {
  dir = mkdtempSync(join(tmpdir(), 'ui-literal-colors-'))
  writeFileSync(join(dir, 'a.tsx'), '<div className="bg-white" />')
  writeFileSync(join(dir, 'tokens.css'), ':root { --brand: #F8CB46; }')
  writeFileSync(join(dir, 'b.ts'), 'const c = "#fff"')
  expect(findLiteralColors(dir, ['b.ts'])).toEqual([{ file: 'a.tsx', match: 'bg-white' }])
})
