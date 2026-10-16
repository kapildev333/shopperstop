import AsyncStorage from '@react-native-async-storage/async-storage'
import { createElement, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { queryClient } from './api'
import {
  cartKey,
  clearCart,
  closeCartSheet,
  getCartSummary,
  loadCartSummary,
  openCartSheet,
  queued,
  setQuantity,
  storeOptions,
  useCartSheetOpen,
  useStoreName,
} from './cart'
import { guestCartKey } from './cart-guest'
import { apiError, fakeCore, json } from './fake-core'
import { setPincode } from './pincode'
import { setToken } from './session'

const storeId = '00000000-0000-4000-8000-000000000401'
const store = {
  id: storeId,
  name: 'Koramangala',
  isOpen: true,
  deliveryFeeCents: 2500,
  freeDeliveryAboveCents: 19900,
  minOrderCents: 9900,
  promisedMinutes: 10,
}
const taaza = {
  id: 'p-taaza',
  name: 'Amul Taaza',
  slug: 'amul-taaza',
  unitLabel: '500 ml',
  mrpCents: 2900,
  priceCents: 2700,
  inStock: true,
  quantity: 5,
}

// Core's cart of two Taaza at the store, every amount of its Cart.
const serverCart = {
  storeId,
  items: [{ product: taaza, quantity: 2 }],
  subtotalCents: 5400,
  deliveryFeeCents: 2500,
  totalCents: 7900,
  minOrderCents: 9900,
  shortfallCents: 14500,
}

test('summary counts the guest cart', async () => {
  setPincode('560034')
  queryClient.setQueryData(['serviceability', '560034'], { store })

  await act(async () => {
    await setQuantity(storeId, taaza, 2)
  })

  expect(getCartSummary()).toEqual({ count: 2, storeId, totalCents: 7900 })
})

test('summary reads the cached server cart', async () => {
  setToken('t-1')
  queryClient.setQueryData(cartKey('t-1'), serverCart)

  expect(getCartSummary()).toEqual({ count: 2, storeId, totalCents: 7900 })
})

test('clear empties the guest cart', async () => {
  await act(async () => {
    await setQuantity(storeId, taaza, 2)
  })
  await waitFor(async () => expect(await AsyncStorage.getItem(guestCartKey)).not.toBeNull())

  await expect(clearCart()).resolves.toBeUndefined()

  expect(getCartSummary().count).toBe(0)
  expect(getCartSummary().storeId).toBeUndefined()
  await expect(AsyncStorage.getItem(guestCartKey)).resolves.toBeNull()
})

test('clear sends DELETE while signed in', async () => {
  setToken('t-1')
  queryClient.setQueryData(cartKey('t-1'), serverCart)
  const calls = fakeCore({ 'DELETE /me/cart': () => json(204) })

  await expect(clearCart()).resolves.toBeUndefined()

  expect(calls.map((request) => `${request.method} ${new URL(request.url).pathname}`)).toContain('DELETE /api/core/v1/me/cart')
  expect(queryClient.getQueryData(cartKey('t-1'))).toMatchObject({ items: [] })
})

test('clear returns core\'s error', async () => {
  setToken('t-1')
  fakeCore({ 'DELETE /me/cart': () => apiError(500, 'internal', 'Core is down') })

  await expect(clearCart()).resolves.toEqual({ code: 'internal', message: 'Core is down' })
})

test('loadCartSummary fetches the server cart', async () => {
  setToken('t-1')
  fakeCore({ 'GET /me/cart': () => json(200, serverCart) })

  await expect(loadCartSummary()).resolves.toEqual({ count: 2, storeId, totalCents: 7900 })
})

test('loadCartSummary resolves undefined when the server cart cannot be read', async () => {
  setToken('t-1')
  fakeCore({ 'GET /me/cart': () => apiError(500, 'internal', 'Core is down') })

  await expect(loadCartSummary()).resolves.toBeUndefined()
})

test('store name from core', async () => {
  fakeCore({ [`GET /stores/${storeId}`]: () => json(200, store) })

  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children)
  const hook = await renderHook(() => useStoreName(storeId), { wrapper })

  await waitFor(() => expect(hook.result.current).toBe('Koramangala'))
  expect(storeOptions(storeId).queryKey).toEqual(['store', storeId])
  expect(queryClient.getQueryData(['store', storeId])).toEqual(store)
})

// The first work is held until the test settles it; the second must not start before that.
async function holdFirst(succeed: boolean) {
  const order: string[] = []
  let settle: (ok: boolean) => void = () => {}
  const first = queued(
    () =>
      new Promise<void>((resolve, reject) => {
        order.push('first')
        settle = (ok) => (ok ? resolve() : reject(new Error('refused')))
      }),
  )
  const second = queued(async () => {
    order.push('second')
  })
  await new Promise((wake) => setTimeout(wake, 0))
  expect(order).toEqual(['first'])
  settle(succeed)
  await first.catch(() => undefined)
  await second
  expect(order).toEqual(['first', 'second'])
}

test('queued runs work in order', async () => {
  await holdFirst(true)
  await holdFirst(false)
})

test('sheet open state', async () => {
  const hook = await renderHook(() => useCartSheetOpen())
  expect(hook.result.current).toBe(false)

  await act(async () => {
    openCartSheet()
  })
  expect(hook.result.current).toBe(true)

  await act(async () => {
    closeCartSheet()
  })
  expect(hook.result.current).toBe(false)
})
