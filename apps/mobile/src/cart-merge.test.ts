import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, waitFor } from '@testing-library/react-native'
import { signIn } from './auth'
import { queryClient } from './api'
import { cartKey, getCartSummary, setQuantity } from './cart'
import { getGuestCart, guestCartKey } from './cart-guest'
import { fakeCore, json } from './fake-core'
import { setToken } from './session'

const storeId = '00000000-0000-4000-8000-000000000401'
const customer = { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.test', name: 'Asha Rao' }
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
const butter = {
  id: 'p-butter',
  name: 'Amul Butter',
  slug: 'amul-butter',
  unitLabel: '100 g',
  mrpCents: 5600,
  priceCents: 5600,
  inStock: true,
  quantity: 5,
}

// Core's cart after the merge: Taaza 2 and Butter 1 at the store, every amount of its Cart.
const serverCart = {
  storeId,
  items: [
    { product: taaza, quantity: 2 },
    { product: butter, quantity: 1 },
  ],
  subtotalCents: 2700 * 2 + 5600,
  deliveryFeeCents: 2500,
  totalCents: 2700 * 2 + 5600 + 2500,
  minOrderCents: 9900,
  shortfallCents: 19900 - (2700 * 2 + 5600),
  clamped: false,
  replaced: false,
}

test('merge bodies in guest order', async () => {
  await act(async () => {
    await setQuantity(storeId, taaza, 2)
    await setQuantity(storeId, butter, 1)
  })
  const bodies: unknown[] = []
  fakeCore({
    'POST /auth/sign-in': () => json(200, { token: 't-1', customer }),
    'PUT /me/cart/items': async (request) => {
      bodies.push(await request.json())
      return json(200, serverCart)
    },
    'GET /me/cart': () => json(200, serverCart),
  })

  await expect(signIn({ email: customer.email, password: 'secret-pass' })).resolves.toBeUndefined()

  expect(bodies).toEqual([
    { storeId, productId: taaza.id, quantity: 2 },
    { storeId, productId: butter.id, quantity: 1 },
  ])
  expect(queryClient.getQueryData(cartKey('t-1'))).toMatchObject({ items: serverCart.items })
  expect(getCartSummary()).toEqual({ count: 3, storeId, totalCents: serverCart.totalCents })
})

test('guest cart discarded after merge', async () => {
  await act(async () => {
    await setQuantity(storeId, taaza, 2)
  })
  await waitFor(async () => expect(await AsyncStorage.getItem(guestCartKey)).not.toBeNull())
  fakeCore({
    'POST /auth/sign-in': () => json(200, { token: 't-1', customer }),
    'PUT /me/cart/items': () => {
      throw new TypeError('Network request failed')
    },
  })

  await expect(signIn({ email: customer.email, password: 'secret-pass' })).resolves.toBeUndefined()

  expect(getGuestCart().items).toEqual([])
  await expect(AsyncStorage.getItem(guestCartKey)).resolves.toBeNull()
})

test('merge dropped when the session changed', async () => {
  await act(async () => {
    await setQuantity(storeId, taaza, 2)
  })
  // A signed-in write holds the queue; the merge is queued behind it.
  setToken('t-1')
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const bodies: unknown[] = []
  fakeCore({
    'PUT /me/cart/items': async (request) => {
      bodies.push(await request.json())
      await held
      return json(200, serverCart)
    },
    'GET /me/cart': () => json(200, serverCart),
  })
  const writing = setQuantity(storeId, taaza, 3)
  await waitFor(() => expect(bodies).toHaveLength(1))

  const merging = signIn({ email: customer.email, password: 'secret-pass' })
  setToken('t-2')
  release()
  await writing
  await merging

  expect(bodies).toEqual([{ storeId, productId: taaza.id, quantity: 3 }])
  expect(getGuestCart().items).toHaveLength(1)
})
