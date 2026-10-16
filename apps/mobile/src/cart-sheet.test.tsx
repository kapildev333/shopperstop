import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import type { StoreProduct } from './catalog'
import { queryClient } from './api'
import { cartKey, openCartSheet, setQuantity } from './cart'
import { cartView, type CartLine } from './cart-guest'
import { CartSheet } from './cart-sheet'
import { fakeCore, json } from './fake-core'
import { setPincode } from './pincode'
import { resolvePincode, type Store } from './serviceability'
import { setToken } from './session'

const storeId = '00000000-0000-4000-8000-000000000401'
const indiranagarId = '00000000-0000-4000-8000-000000000402'
const store = {
  id: storeId,
  name: 'Koramangala',
  isOpen: true,
  deliveryFeeCents: 2500,
  freeDeliveryAboveCents: 19900,
  minOrderCents: 9900,
  promisedMinutes: 10,
}
const indiranagar: Store = { ...store, id: indiranagarId, name: 'Indiranagar', promisedMinutes: 12 }
const fees = { deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900 }

const taaza: StoreProduct = {
  id: 'p-taaza',
  name: 'Amul Taaza',
  slug: 'amul-taaza',
  unitLabel: '500 ml',
  mrpCents: 2900,
  priceCents: 2700,
  categoryId: 'c-milk',
  inStock: true,
  quantity: 20,
}
const butter: StoreProduct = {
  id: 'p-butter',
  name: 'Amul Butter',
  slug: 'amul-butter',
  unitLabel: '100 g',
  mrpCents: 5600,
  priceCents: 5600,
  categoryId: 'c-dairy',
  inStock: true,
  quantity: 20,
}

// The store the pincode resolves to, with the store lookups the sheet makes.
async function serve(current: Store = store, routes: Parameters<typeof fakeCore>[0] = {}) {
  setPincode('560034')
  fakeCore({
    'GET /serviceability': () => json(200, { store: current }),
    [`GET /stores/${storeId}`]: () => json(200, store),
    [`GET /stores/${indiranagarId}`]: () => json(200, indiranagar),
    ...routes,
  })
  await resolvePincode('560034')
}

// A cart answer as core sends it: the view's fields, priced at the store's fees.
function cart(items: CartLine[], at = storeId, extra: Record<string, unknown> = {}) {
  return { ...cartView({ storeId: at, items }, fees), ...extra }
}

function sheet() {
  return (
    <QueryClientProvider client={queryClient}>
      <CartSheet />
    </QueryClientProvider>
  )
}

async function openSheet() {
  await act(async () => {
    openCartSheet()
  })
}

test('sheet lines and bill', async () => {
  await serve()
  await setQuantity(storeId, taaza, 2)
  await setQuantity(storeId, butter, 1)
  await openSheet()
  await render(sheet())

  expect(screen.getByText('Delivery in 10 minutes')).toBeTruthy()
  expect(screen.getByText('Shipment of 3 items')).toBeTruthy()
  expect(screen.getByText('Amul Taaza')).toBeTruthy()
  expect(screen.getByText('500 ml')).toBeTruthy()
  expect(screen.getByText('Amul Butter')).toBeTruthy()
  expect(screen.getByText('100 g')).toBeTruthy()
  expect(screen.getByText('₹54')).toBeTruthy()
  expect(screen.getByText('₹56')).toBeTruthy()
  expect(screen.getByLabelText('Quantity of Amul Taaza')).toBeTruthy()
  expect(screen.getByLabelText('Quantity of Amul Butter')).toBeTruthy()
  expect(screen.getByText('Add ₹89 more for free delivery.')).toBeTruthy()
  expect(screen.getByText('Items total')).toBeTruthy()
  expect(screen.getByLabelText('MRP ₹114')).toBeTruthy()
  expect(screen.getByText('₹110')).toBeTruthy()
  expect(screen.getByText('Delivery fee')).toBeTruthy()
  expect(screen.getByText('₹25')).toBeTruthy()
  expect(screen.getByText('Grand total')).toBeTruthy()
  expect(screen.getByText('₹135')).toBeTruthy()
})

test('free delivery', async () => {
  await serve()
  // Eight of Amul Taaza is 21600, above the 19900 threshold.
  await setQuantity(storeId, taaza, 8)
  await openSheet()
  await render(sheet())

  expect(screen.getByText('FREE')).toBeTruthy()
  expect(screen.queryByText(/more for free delivery/)).toBeNull()
})

test('out-of-stock line', async () => {
  await serve()
  setToken('t-1')
  const bodies: unknown[] = []
  const soldOut = { ...butter, inStock: false }
  fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}`]: () => json(200, store),
    'GET /me/cart': () => json(200, cart([{ product: soldOut, quantity: 1 }])),
    'PUT /me/cart/items': async (request) => {
      bodies.push(await request.json())
      return json(200, { ...cart([]), replaced: false, clamped: false })
    },
  })
  await openSheet()
  await render(sheet())

  expect(await screen.findByRole('button', { name: 'Out of stock' })).toBeDisabled()
  void fireEvent.press(screen.getByRole('button', { name: 'Remove Amul Butter' }))
  await waitFor(() => expect(bodies).toEqual([{ storeId, productId: 'p-butter', quantity: 0 }]))
})

test('below the minimum order', async () => {
  await serve()
  await setQuantity(storeId, taaza, 2)
  await openSheet()
  await render(sheet())

  expect(screen.getByText('Minimum order is ₹99. Add ₹45 more to check out.')).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Proceed to checkout' })).toBeNull()
})

test('empty cart', async () => {
  await serve()
  await openSheet()
  await render(sheet())

  expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeTruthy()
  expect(screen.getByText('Milk, bread, snacks and more, delivered from the store near you in minutes.')).toBeTruthy()
  void fireEvent.press(screen.getByRole('button', { name: 'Start shopping' }))
  await waitFor(() => expect(screen.queryByText('Your cart is empty')).toBeNull())
})

test('loading and failed cart', async () => {
  await serve()
  setToken('t-1')
  let attempts = 0
  let fail: () => void = () => {}
  fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}`]: () => json(200, store),
    'GET /me/cart': () => {
      attempts += 1
      if (attempts > 1) return json(200, cart([{ product: taaza, quantity: 1 }]))
      return new Promise<Response>((_, reject) => {
        fail = () => reject(new TypeError('Network request failed'))
      })
    },
  })
  await openSheet()
  await render(sheet())

  expect(screen.getByLabelText('Loading')).toBeTruthy()
  await waitFor(() => expect(attempts).toBe(1))
  await act(async () => fail())
  expect(await screen.findByText("You're offline")).toBeTruthy()
  void fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByLabelText('Quantity of Amul Taaza')).toBeTruthy()
})

test('answer wins over what was sent', async () => {
  await serve()
  setToken('t-1')
  const sent: number[] = []
  fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}`]: () => json(200, store),
    'GET /me/cart': () => json(200, cart([{ product: taaza, quantity: 3 }])),
    'PUT /me/cart/items': async (request) => {
      sent.push(((await request.json()) as { quantity: number }).quantity)
      return json(200, { ...cart([{ product: taaza, quantity: 2 }]), clamped: true, replaced: false })
    },
  })
  await openSheet()
  await render(sheet())

  void fireEvent.press(await screen.findByRole('button', { name: 'Add one Amul Taaza' }))
  await waitFor(() => expect(within(screen.getByLabelText('Quantity of Amul Taaza')).getByText('2')).toBeTruthy())
  expect(sent).toEqual([4])
  expect(screen.getByText('Some quantities were lowered to what the store has.')).toBeTruthy()
})

test('line clamped away', async () => {
  await serve()
  setToken('t-1')
  queryClient.setQueryData(cartKey('t-1'), cart([], storeId, { clamped: true }))
  await openSheet()
  await render(sheet())

  expect(screen.getByText('Some quantities were lowered to what the store has.')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeTruthy()
})

test('replaced notice names the old store', async () => {
  await serve(indiranagar)
  setToken('t-1')
  queryClient.setQueryData(cartKey('t-1'), cart([{ product: taaza, quantity: 2 }], indiranagarId))
  await render(sheet())
  expect(screen.queryByLabelText('Quantity of Amul Taaza')).toBeNull()

  await act(async () => {
    queryClient.setQueryData(cartKey('t-1'), {
      ...cart([{ product: taaza, quantity: 2 }], indiranagarId),
      replaced: true,
      replacedStoreId: storeId,
    })
  })

  expect(await screen.findByText('Your cart from Koramangala was replaced. A cart holds products from one store.')).toBeTruthy()
  expect(screen.getByLabelText('Quantity of Amul Taaza')).toBeTruthy()
})

test('replace opens the sheet once', async () => {
  await serve()
  setToken('t-1')
  queryClient.setQueryData(cartKey('t-1'), cart([{ product: taaza, quantity: 2 }]))
  await render(sheet())
  expect(screen.queryByLabelText('Quantity of Amul Taaza')).toBeNull()

  await act(async () => {
    queryClient.setQueryData(cartKey('t-1'), { ...cart([{ product: taaza, quantity: 2 }]), replaced: true })
  })
  expect(await screen.findByLabelText('Quantity of Amul Taaza')).toBeTruthy()

  void fireEvent.press(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByLabelText('Quantity of Amul Taaza')).toBeNull())

  await act(async () => {
    queryClient.setQueryData(cartKey('t-1'), { ...cart([{ product: taaza, quantity: 2 }]), replaced: false })
  })
  expect(screen.queryByLabelText('Quantity of Amul Taaza')).toBeNull()
})

test('replaced notice without the old store', async () => {
  await serve()
  setToken('t-1')
  queryClient.setQueryData(cartKey('t-1'), cart([{ product: taaza, quantity: 2 }]))
  await render(sheet())

  await act(async () => {
    queryClient.setQueryData(cartKey('t-1'), { ...cart([{ product: taaza, quantity: 2 }]), replaced: true })
  })

  expect(await screen.findByText('Your cart from another store was replaced. A cart holds products from one store.')).toBeTruthy()
})

test('failed write in the sheet', async () => {
  await serve()
  setToken('t-1')
  fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}`]: () => json(200, store),
    'GET /me/cart': () => json(200, cart([{ product: taaza, quantity: 1 }])),
    'PUT /me/cart/items': () => Promise.reject(new TypeError('Network request failed')),
  })
  await openSheet()
  await render(sheet())

  void fireEvent.press(await screen.findByRole('button', { name: 'Add one Amul Taaza' }))
  expect(await screen.findByText('Could not reach ShopperStop. Try again.')).toBeTruthy()
})
