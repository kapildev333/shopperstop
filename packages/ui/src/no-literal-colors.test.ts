import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { findLiteralColors } from './testing/literal-colors'

test('no literal colours in src', () => {
  const src = fileURLToPath(new URL('.', import.meta.url))
  expect(
    findLiteralColors(src, ['tokens.test.ts', 'testing/literal-colors.ts', 'testing/literal-colors.test.ts']),
  ).toEqual([])
})
