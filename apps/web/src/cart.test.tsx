import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { components } from '@shopperstop/ui/api'
import { queryClient } from './api'
import { cartKey, mergeGuestCart } from './cart'
import { keys } from './catalog'
import { dispatchGuest, getGuestCart } from './guest-cart'
import { ProductCard } from './product-card'
import { setPincode } from './pincode'
import { setToken } from './session'
import { product, renderInRouter, store } from './test-data'

type Cart = components['schemas']['Cart']

afterEach(() => vi.unstubAllGlobals())

const koramangala = '00000000-0000-4000-8000-000000000401'
const indiranagar = '00000000-0000-4000-8000-000000000402'

// Resolves 560034 to Koramangala, so the cart is read at that store.
function resolveStore() {
  setPincode('560034')
  queryClient.setQueryData(keys.serviceability('560034'), store())
}

function serverCart(storeId: string, quantity: number): Cart {
  const taaza = product()
  return {
    storeId,
    items: [{ product: taaza, quantity }],
    subtotalCents: taaza.priceCents * quantity,
    deliveryFeeCents: 0,
    totalCents: taaza.priceCents * quantity,
    minOrderCents: 0,
    shortfallCents: 0,
  }
}

test('card adds to the guest cart', async () => {
  resolveStore()
  renderInRouter(<ProductCard product={product({ name: 'Amul Taaza' })} />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Add Amul Taaza' }))
  const group = screen.getByRole('group', { name: 'Quantity of Amul Taaza' })
  expect(within(group).getByText('1')).toBeInTheDocument()
  const stored = JSON.parse(localStorage.getItem('shopperstop:cart') ?? 'null')
  expect(stored.storeId).toBe(koramangala)
  expect(stored.items).toEqual([{ product: expect.objectContaining({ id: product().id }), quantity: 1 }])
})

test('card shows the server cart', async () => {
  resolveStore()
  setToken('t')
  queryClient.setQueryData(cartKey('t'), serverCart(koramangala, 3))
  renderInRouter(<ProductCard product={product({ name: 'Amul Taaza' })} />)
  const group = await screen.findByRole('group', { name: 'Quantity of Amul Taaza' })
  expect(within(group).getByText('3')).toBeInTheDocument()
})

test('card ignores a cart at another store', async () => {
  resolveStore()
  setToken('t')
  queryClient.setQueryData(cartKey('t'), serverCart(indiranagar, 3))
  renderInRouter(<ProductCard product={product({ name: 'Amul Taaza' })} />)
  expect(await screen.findByRole('button', { name: 'Add Amul Taaza' })).toBeEnabled()
  expect(screen.queryByRole('group', { name: 'Quantity of Amul Taaza' })).toBeNull()
})

test('guest cart discarded after merge', async () => {
  dispatchGuest({ type: 'set', storeId: koramangala, product: product(), quantity: 2 })
  setToken('t')
  // Core cannot be reached under jsdom: every push fails, and the guest cart is still discarded.
  await mergeGuestCart()
  expect(localStorage.getItem('shopperstop:cart')).toBeNull()
  expect(getGuestCart()).toEqual({ items: [] })
})

// The Stepper's count for Amul Taaza, read as the card shows it.
function shownCount() {
  return Number(screen.getByRole('group', { name: 'Quantity of Amul Taaza' }).querySelector('span')?.textContent)
}

test('quick taps each count', async () => {
  resolveStore()
  setToken('t')
  queryClient.setQueryData(cartKey('t'), serverCart(koramangala, 1))
  renderInRouter(<ProductCard product={product({ name: 'Amul Taaza' })} />)
  await screen.findByRole('button', { name: 'Add one Amul Taaza' })
  // Synchronous taps, no answer awaited in between: each one counts from the last.
  fireEvent.click(screen.getByRole('button', { name: 'Add one Amul Taaza' }))
  expect(shownCount()).toBe(2)
  fireEvent.click(screen.getByRole('button', { name: 'Add one Amul Taaza' }))
  expect(shownCount()).toBe(3)
  fireEvent.click(screen.getByRole('button', { name: 'Remove one Amul Taaza' }))
  expect(shownCount()).toBe(2)
  // Under jsdom every write fails; the Stepper returns to the cart's count once the writes have settled.
  await waitFor(() => expect(shownCount()).toBe(1))
})

test('failed write returns to the cart\'s count', async () => {
  resolveStore()
  setToken('t')
  queryClient.setQueryData(cartKey('t'), serverCart(koramangala, 1))
  renderInRouter(<ProductCard product={product({ name: 'Amul Taaza' })} />)
  await screen.findByRole('button', { name: 'Add one Amul Taaza' })
  fireEvent.click(screen.getByRole('button', { name: 'Add one Amul Taaza' }))
  expect(shownCount()).toBe(2)
  await waitFor(() => expect(shownCount()).toBe(1))
})

test('guest taps each count', async () => {
  resolveStore()
  renderInRouter(<ProductCard product={product({ name: 'Amul Taaza' })} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Add Amul Taaza' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add one Amul Taaza' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add one Amul Taaza' }))
  expect(shownCount()).toBe(3)
  const stored = JSON.parse(localStorage.getItem('shopperstop:cart') ?? 'null')
  expect(stored.items[0].quantity).toBe(3)
})

test('merge queued behind a session change leaves the guest cart', async () => {
  setToken('a')
  dispatchGuest({ type: 'set', storeId: koramangala, product: product(), quantity: 2 })
  // The merge waits in the queue; the session changes before it runs, so its pushes must not go out for the new session.
  const merging = mergeGuestCart()
  setToken('b')
  await merging
  expect(getGuestCart().items).toHaveLength(1)
})

test('failed write tells the customer', async () => {
  resolveStore()
  setToken('t')
  queryClient.setQueryData(cartKey('t'), serverCart(koramangala, 1))
  renderInRouter(<ProductCard product={product({ name: 'Amul Taaza' })} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Add one Amul Taaza' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach ShopperStop. Try again.')
  expect(shownCount()).toBe(1)
})

test('next tap clears the failure', async () => {
  resolveStore()
  setToken('t')
  queryClient.setQueryData(cartKey('t'), serverCart(koramangala, 1))
  renderInRouter(<ProductCard product={product({ name: 'Amul Taaza' })} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Add one Amul Taaza' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Add one Amul Taaza' }))
  expect(screen.queryByRole('alert')).toBeNull()
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach ShopperStop. Try again.')
})

test('overtaken write shows no failure', async () => {
  resolveStore()
  setToken('t')
  queryClient.setQueryData(cartKey('t'), serverCart(koramangala, 1))
  renderInRouter(<ProductCard product={product({ name: 'Amul Taaza' })} />)
  await screen.findByRole('button', { name: 'Add one Amul Taaza' })
  // Two taps in one tick: the first write is overtaken and skipped; the second one's failure is the one shown.
  fireEvent.click(screen.getByRole('button', { name: 'Add one Amul Taaza' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add one Amul Taaza' }))
  await waitFor(() => expect(shownCount()).toBe(1))
  await screen.findByRole('alert')
  expect(screen.getAllByRole('alert')).toHaveLength(1)
})

// Core answers the cart read at once and holds every write until the test answers it.
function holdWrites() {
  const writes: ((answer: Response) => void)[] = []
  vi.stubGlobal('fetch', async (request: Request) => {
    if (request.method === 'GET') {
      return new Response(JSON.stringify(serverCart(koramangala, 1)), { headers: { 'Content-Type': 'application/json' } })
    }
    return new Promise<Response>((resolve) => writes.push(resolve))
  })
  return writes
}

test('overtaken in-flight write shows no failure', async () => {
  resolveStore()
  setToken('t')
  queryClient.setQueryData(cartKey('t'), serverCart(koramangala, 1))
  renderInRouter(<ProductCard product={product({ name: 'Amul Taaza' })} />)
  const writes = holdWrites()
  fireEvent.click(await screen.findByRole('button', { name: 'Add one Amul Taaza' }))
  await waitFor(() => expect(writes).toHaveLength(1))
  // The second tap lands while the first write is in flight: that tap's write answers for the line.
  fireEvent.click(screen.getByRole('button', { name: 'Add one Amul Taaza' }))
  writes[0](
    new Response(JSON.stringify({ error: { code: 'validation', field: 'productId', message: 'product not available' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  // The second write goes out only once the first has settled, so no alert may show by then.
  await waitFor(() => expect(writes).toHaveLength(2))
  expect(screen.queryByRole('alert')).toBeNull()
  writes[1](
    new Response(JSON.stringify({ ...serverCart(koramangala, 3), clamped: false, replaced: false }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  await waitFor(() => expect(shownCount()).toBe(3))
  expect(screen.queryByRole('alert')).toBeNull()
})
