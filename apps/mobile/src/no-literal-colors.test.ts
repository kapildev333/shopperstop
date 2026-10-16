import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { findLiteralColors, matchLiteralColors } from '@shopperstop/ui/testing'

// React Native takes CSS colour names as quoted strings; the shared scanner has no pattern for them.
// The samples below are built from pieces so that this file does not hold the text it scans for.
const names = 'black blue gray green grey orange pink purple red silver transparent white yellow'
const quoted = new RegExp(`(['"])(?:${names.split(' ').join('|')})\\1`, 'gi')
const src = __dirname

function quotedNames(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => ['.ts', '.tsx'].includes(extname(file)))
    .flatMap((file) => readFileSync(join(dir, file), 'utf8').match(quoted) ?? [])
}

test('no literal colours in src', () => {
  expect(findLiteralColors(src)).toEqual([])
  expect(quotedNames(src)).toEqual([])
})

test('scanner finds literal colours', () => {
  const hash = '#'
  const quote = "'"
  const sample = `bg ${hash}fff; ` + 'rgba' + '(0,0,0,0.5); ' + quote + 'wh' + 'ite' + quote
  expect(matchLiteralColors(sample)).toEqual([hash + 'fff', 'rgba' + '('])
  expect(sample.match(quoted)).toEqual([quote + 'wh' + 'ite' + quote])
})
