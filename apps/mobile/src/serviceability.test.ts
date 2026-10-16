import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react-native'
import { createElement, type ReactNode } from 'react'
import { queryClient } from './api'
import { fakeCore, json } from './fake-core'
import { setPincode } from './pincode'
import { resolvePincode, useStore } from './serviceability'

const store = {
  id: '00000000-0000-4000-8000-000000000401',
  name: 'Koramangala',
  isOpen: true,
  deliveryFeeCents: 2500,
  freeDeliveryAboveCents: 19900,
  minOrderCents: 9900,
  promisedMinutes: 10,
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

test('resolvePincode caches the answer', async () => {
  const calls = fakeCore({ 'GET /serviceability': () => json(200, { store }) })

  const answer = await resolvePincode('560034')
  expect(answer.store?.name).toBe('Koramangala')

  setPincode('560034')
  const hook = await renderHook(() => useStore(), { wrapper })

  expect(hook.result.current).toMatchObject({ kind: 'open', pincode: '560034', store: { name: 'Koramangala' } })
  expect(calls).toHaveLength(1)
})
