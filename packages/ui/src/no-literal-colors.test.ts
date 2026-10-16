import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { findLiteralColors, matchLiteralColors } from './testing/literal-colors'

const ignore = ['tokens.test.ts', 'tokens.ts', 'testing/literal-colors.ts', 'testing/literal-colors.test.ts']

test('no literal colours in src', () => {
  const src = dirname(fileURLToPath(import.meta.url))
  expect(findLiteralColors(src, ignore)).toEqual([])
})

test('generated token module is exempt', () => {
  const src = dirname(fileURLToPath(import.meta.url))
  const tokens = readFileSync(join(src, 'tokens.ts'), 'utf8')
  expect(matchLiteralColors(tokens).length).toBeGreaterThan(0)
  expect(findLiteralColors(src, ignore).filter((f) => f.file === 'tokens.ts')).toEqual([])
})
