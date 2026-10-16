import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react-native'
import type { StoreProduct } from './catalog'
import { queryClient } from './api'
import { cartKey, setQuantity, useCartSheetOpen } from './cart'
import { Text } from './ui/text'
import { CartBar } from './cart-bar'
import { fakeCore, json } from './fake-core'
import { setPincode } from './pincode'
import { resolvePincode } from './serviceability'
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
const taaza: StoreProduct = {
  id: 'p-taaza',
  name: 'Amul Taaza',
  slug: 'amul-taaza',
  unitLabel: '500 ml',
  mrpCents: 2900,
  priceCents: 2700,
  categoryId: 'c-milk',
  inStock: true,
  quantity: 5,
}

// A server cart of Amul Taaza at a store, every field of core's Cart.
function serverCart(quantity: number, at = storeId) {
  const subtotalCents = taaza.priceCents * quantity
  return {
    storeId: at,
    items: [{ product: taaza, quantity }],
    subtotalCents,
    deliveryFeeCents: 2500,
    totalCents: subtotalCents + 2500,
    minOrderCents: 9900,
    shortfallCents: Math.max(0, 19900 - subtotalCents),
  }
}

// The bar is rendered inside the query client, as the root layout does, with the store resolved for its fee.
async function serve(routes: Parameters<typeof fakeCore>[0] = {}) {
  setPincode('560034')
  fakeCore({ 'GET /serviceability': () => json(200, { store }), ...routes })
  await resolvePincode('560034')
}

// The sheet's open state, shown as text in the same tree (a second render would replace what `screen` reads).
function SheetState() {
  return <Text>{useCartSheetOpen() ? 'sheet open' : 'sheet closed'}</Text>
}

function bar() {
  return (
    <QueryClientProvider client={queryClient}>
      <CartBar />
      <SheetState />
    </QueryClientProvider>
  )
}

test('bar follows the cart', async () => {
  await serve()
  await render(bar())
  expect(screen.queryByRole('button', { name: /^View cart/ })).toBeNull()
  expect(screen.getByText('sheet closed')).toBeTruthy()

  await setQuantity(storeId, taaza, 2)

  expect(await screen.findByText('2 items')).toBeTruthy()
  expect(screen.getByText('₹79')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: /^View cart/ }))
  expect(await screen.findByText('sheet open')).toBeTruthy()
})

test('bar shows the replaced notice', async () => {
  // The cart was at Koramangala; the last answer put one line at Indiranagar and said it replaced the old cart.
  setToken('t-1')
  await serve({ [`GET /stores/${storeId}`]: () => json(200, store) })
  queryClient.setQueryData(cartKey('t-1'), { ...serverCart(2, indiranagarId), replaced: true, replacedStoreId: storeId })
  await render(bar())

  expect(
    await screen.findByText('Your cart from Koramangala was replaced. A cart holds products from one store.'),
  ).toBeTruthy()
  expect(screen.getByRole('button', { name: /^View cart/ })).toBeTruthy()
})

test('bar names another store while the old one is unknown', async () => {
  setToken('t-1')
  await serve()
  queryClient.setQueryData(cartKey('t-1'), { ...serverCart(2, indiranagarId), replaced: true })
  await render(bar())

  expect(
    await screen.findByText('Your cart from another store was replaced. A cart holds products from one store.'),
  ).toBeTruthy()
})
