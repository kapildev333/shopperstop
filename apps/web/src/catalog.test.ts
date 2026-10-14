import { expect, test } from 'vitest'
import { serviceabilityMissing } from './catalog'

test('only not_serviceable means no store delivers', () => {
  expect(serviceabilityMissing(404, { error: { code: 'not_serviceable', message: 'No store delivers to 110001.' } })).toBe(true)
  expect(serviceabilityMissing(404, { error: { code: 'not_found', message: 'Nothing here.' } })).toBe(false)
  expect(serviceabilityMissing(404, undefined)).toBe(false)
  expect(serviceabilityMissing(200, undefined)).toBe(false)
})
