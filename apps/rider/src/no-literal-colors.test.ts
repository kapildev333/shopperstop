import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findLiteralColors } from '@shopperstop/ui/testing'
import { expect, test } from 'vitest'

test('no literal colours in src', () => {
  expect(findLiteralColors(dirname(fileURLToPath(import.meta.url)))).toEqual([])
})
