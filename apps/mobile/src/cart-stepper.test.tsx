import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import type { StoreProduct } from './catalog'
import { ProductCard } from './catalog-card'
import { queryClient } from './api'
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

type Routes = Parameters<typeof fakeCore>[0]

// Core answers the open store for 560034; the store is resolved before the card renders, as the screens do.
async function serve(routes: Routes = {}) {
  setPincode('560034')
  fakeCore({ 'GET /serviceability': () => json(200, { store }), ...routes })
  await resolvePincode('560034')
}

// A server cart of Amul Taaza, every field of core's Cart.
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

function card() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProductCard product={taaza} storeId={storeId} />
    </QueryClientProvider>
  )
}

function countOf(group: ReturnType<typeof screen.getByLabelText>) {
  return within(group).getByText(/^\d+$/).props.children
}

test('card adds to the guest cart', async () => {
  await serve()
  await render(card())

  await fireEvent.press(screen.getByRole('button', { name: 'Add Amul Taaza' }))

  expect(countOf(screen.getByLabelText('Quantity of Amul Taaza'))).toBe('1')
  await waitFor(async () => {
    const stored = JSON.parse((await AsyncStorage.getItem('shopperstop:cart')) ?? 'null')
    expect(stored.storeId).toBe(storeId)
    expect(stored.items).toEqual([expect.objectContaining({ quantity: 1, product: expect.objectContaining({ id: 'p-taaza' }) })])
  })
})

test('card shows the server cart', async () => {
  await serve({ 'GET /me/cart': () => json(200, serverCart(3)) })
  setToken('t-1')
  await render(card())

  expect(countOf(await screen.findByLabelText('Quantity of Amul Taaza'))).toBe('3')
})

test('card ignores a cart at another store', async () => {
  await serve({ 'GET /me/cart': () => json(200, serverCart(3, indiranagarId)) })
  setToken('t-1')
  await render(card())

  expect(await screen.findByRole('button', { name: 'Add Amul Taaza' })).toBeTruthy()
  expect(screen.queryByLabelText('Quantity of Amul Taaza')).toBeNull()
})

test('guest taps each count', async () => {
  await serve()
  await render(card())

  await fireEvent.press(screen.getByRole('button', { name: 'Add Amul Taaza' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Add one Amul Taaza' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Add one Amul Taaza' }))

  expect(countOf(screen.getByLabelText('Quantity of Amul Taaza'))).toBe('3')
  await waitFor(async () => {
    const stored = JSON.parse((await AsyncStorage.getItem('shopperstop:cart')) ?? 'null')
    expect(stored.items[0].quantity).toBe(3)
  })
})

test('quick taps each count', async () => {
  // Every write is held until the test releases it, oldest first.
  const bodies: number[] = []
  const held: Array<() => void> = []
  await serve({
    'GET /me/cart': () => json(200, serverCart(1)),
    'PUT /me/cart/items': async (request) => {
      const body = (await request.json()) as { quantity: number }
      bodies.push(body.quantity)
      await new Promise<void>((release) => held.push(release))
      return json(200, { ...serverCart(body.quantity), replaced: false, clamped: false })
    },
  })
  setToken('t-1')
  await render(card())
  const group = await screen.findByLabelText('Quantity of Amul Taaza')

  await fireEvent.press(within(group).getByRole('button', { name: 'Add one Amul Taaza' }))
  expect(countOf(screen.getByLabelText('Quantity of Amul Taaza'))).toBe('2')
  await fireEvent.press(within(group).getByRole('button', { name: 'Add one Amul Taaza' }))
  expect(countOf(screen.getByLabelText('Quantity of Amul Taaza'))).toBe('3')
  await fireEvent.press(within(group).getByRole('button', { name: 'Remove one Amul Taaza' }))
  expect(countOf(screen.getByLabelText('Quantity of Amul Taaza'))).toBe('2')

  // Only the first write has reached core; the next one waits for its answer.
  await waitFor(() => expect(held).toHaveLength(1))
  expect(bodies).toEqual([2])
  held.shift()?.()
  await waitFor(() => expect(held).toHaveLength(1))
  expect(bodies).toEqual([2, 2])
  held.shift()?.()
  await waitFor(() => expect(countOf(screen.getByLabelText('Quantity of Amul Taaza'))).toBe('2'))
})

test("failed write returns to the cart's count", async () => {
  let fail: () => void = () => {}
  await serve({
    'GET /me/cart': () => json(200, serverCart(1)),
    'PUT /me/cart/items': () =>
      new Promise<Response>((_, reject) => {
        fail = () => reject(new TypeError('Network request failed'))
      }),
  })
  setToken('t-1')
  await render(card())
  const group = await screen.findByLabelText('Quantity of Amul Taaza')

  await fireEvent.press(within(group).getByRole('button', { name: 'Add one Amul Taaza' }))
  expect(countOf(screen.getByLabelText('Quantity of Amul Taaza'))).toBe('2')

  fail()
  await waitFor(() => expect(countOf(screen.getByLabelText('Quantity of Amul Taaza'))).toBe('1'))
})
