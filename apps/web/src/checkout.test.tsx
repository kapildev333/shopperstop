import { screen, waitFor, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { queryClient } from './api'
import { cartKey } from './cart'
import { CheckoutPage } from './checkout'
import { storeKey } from './cart-drawer'
import { keys } from './catalog'
import { orderKey, ordersKey, postOrder, type OrderResult } from './orders'
import { cartView, type CartProduct, type CartView } from './guest-cart'
import { setPincode } from './pincode'
import { setToken } from './session'
import { address, order, product, renderAt, renderInRouter, store, type Address, type Store } from './test-data'

const koramangala = '00000000-0000-4000-8000-000000000401'
const indiranagar = '00000000-0000-4000-8000-000000000402'
const taaza = product()
const butter = product({
  id: '00000000-0000-4000-8000-000000000602',
  name: 'Amul Butter',
  slug: 'amul-butter',
  unitLabel: '100 g',
  priceCents: 5600,
  mrpCents: 5600,
})
const home = address()
const work = address({ id: '00000000-0000-4000-8000-000000000302', label: 'Work', line1: '4 Park Street', pincode: '560038', isDefault: false })

// Signed in, with the cart, its store and the addresses seeded (no HTTP): the page asks core for none of them.
function seed({
  lines = [[taaza, 2]],
  addresses = [home],
  storeOverrides = {},
}: {
  lines?: [CartProduct, number][]
  addresses?: Address[]
  storeOverrides?: Partial<Store>
} = {}) {
  const fees = store(storeOverrides)
  setToken('t')
  queryClient.setQueryData(storeKey(koramangala), fees)
  queryClient.setQueryData(
    cartKey('t'),
    cartView({ storeId: koramangala, items: lines.map(([p, quantity]) => ({ product: p, quantity })) }, fees),
  )
  queryClient.setQueryData(['addresses', 't'], addresses)
}

// The value beside a summary label: the dd after its dt.
function row(region: HTMLElement, label: string) {
  return within(region).getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement
}

test('signed-out checkout redirect', async () => {
  const router = renderAt('/checkout')
  expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
  expect(router.state.location.href).toBe('/sign-in?returnTo=%2Fcheckout')
})

test('checkout summary from the cart', async () => {
  seed({
    lines: [
      [taaza, 2],
      [butter, 1],
    ],
    storeOverrides: { deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900 },
  })
  renderAt('/checkout')
  const summary = await screen.findByRole('region', { name: 'Order summary' })
  expect(within(summary).getByText('Amul Taaza')).toBeInTheDocument()
  expect(within(summary).getByText('Qty 2')).toBeInTheDocument()
  expect(within(summary).getByText('₹54')).toBeInTheDocument()
  expect(within(summary).getByText('Amul Butter')).toBeInTheDocument()
  expect(within(summary).getByText('Qty 1')).toBeInTheDocument()
  expect(within(summary).getByText('₹56')).toBeInTheDocument()
  expect(row(summary, 'Subtotal')).toHaveTextContent('₹110')
  expect(row(summary, 'Delivery fee')).toHaveTextContent('₹25')
  expect(row(summary, 'Total')).toHaveTextContent('₹135')
  expect(within(summary).getByText('Cash on delivery')).toBeInTheDocument()
  expect(within(summary).getByRole('button', { name: 'Place order (COD)' })).toBeEnabled()

  await userEvent.click(within(summary).getByRole('button', { name: 'Edit cart' }))
  expect(screen.getByRole('dialog', { name: 'Your cart' })).toBeInTheDocument()
})

test("summary names the cart's store", async () => {
  setPincode('560038')
  queryClient.setQueryData(keys.serviceability('560038'), store({ id: indiranagar, name: 'Indiranagar', promisedMinutes: 12 }))
  seed()
  renderAt('/checkout')
  const summary = await screen.findByRole('region', { name: 'Order summary' })
  expect(within(summary).getByText('From Koramangala')).toBeInTheDocument()
  expect(within(summary).getByText('Delivery in 10 minutes')).toBeInTheDocument()
  expect(within(summary).queryByText(/Indiranagar/)).toBeNull()
})

test('empty, loading and failed checkout', async () => {
  seed({ lines: [] })
  renderAt('/checkout')
  expect(await screen.findByText('Your cart is empty')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('link', { name: 'Your orders' })).toHaveAttribute('href', '/orders')
  expect(screen.queryByRole('button', { name: 'Place order (COD)' })).toBeNull()

  // Signed in with no cart cached: the request is made and fails under jsdom; the loading state shows first.
  cleanup()
  queryClient.clear()
  setToken('t')
  renderAt('/checkout')
  await screen.findByRole('heading', { level: 1, name: 'Checkout' })
  expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your cart.')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

test('default address chosen', async () => {
  seed({ lines: [[taaza, 4]], addresses: [work, home], storeOverrides: { minOrderCents: 9900 } })
  renderAt('/checkout')
  const addresses = await screen.findByRole('region', { name: 'Delivery address' })
  expect(within(addresses).getByRole('button', { name: 'Deliver to Home' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(addresses).getByRole('button', { name: 'Deliver to Work' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Place order (COD)' })).toBeEnabled()
})

test('another address chosen', async () => {
  seed({ lines: [[taaza, 4]], addresses: [work, home], storeOverrides: { minOrderCents: 9900 } })
  renderAt('/checkout')
  const addresses = await screen.findByRole('region', { name: 'Delivery address' })
  await userEvent.click(within(addresses).getByRole('button', { name: 'Deliver to Work' }))
  expect(within(addresses).getByRole('button', { name: 'Deliver to Work' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(addresses).getByRole('button', { name: 'Deliver to Home' })).toHaveAttribute('aria-pressed', 'false')
})

test('no address yet', async () => {
  seed({ lines: [[taaza, 4]], addresses: [], storeOverrides: { minOrderCents: 9900 } })
  renderAt('/checkout')
  const addresses = await screen.findByRole('region', { name: 'Delivery address' })
  expect(within(addresses).getByText('No addresses yet')).toBeInTheDocument()
  expect(within(addresses).getByRole('button', { name: 'Add address' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Place order (COD)' })).toBeDisabled()
})

test('checkout below the minimum', async () => {
  seed({ lines: [[taaza, 2]], storeOverrides: { minOrderCents: 9900 } })
  renderAt('/checkout')
  const summary = await screen.findByRole('region', { name: 'Order summary' })
  expect(within(summary).getByText('Minimum order is ₹99. Add ₹45 more to place the order.')).toBeInTheDocument()
  expect(within(summary).getByRole('button', { name: 'Place order (COD)' })).toBeDisabled()
})

test('empty checkout links to orders', async () => {
  seed({ lines: [] })
  queryClient.setQueryData(ordersKey('t'), { items: [], page: 1, pageSize: 24, total: 0 })
  const router = renderAt('/checkout')
  await userEvent.click(await screen.findByRole('link', { name: 'Your orders' }))
  expect(router.state.location.pathname).toBe('/orders')
  expect(await screen.findByRole('heading', { level: 1, name: 'Your orders' })).toBeInTheDocument()
})

// A send prop that answers one placement per call, in order; it records the address id of each request.
function sender(...answers: OrderResult[]) {
  const asked: string[] = []
  const send = async (addressId: string) => {
    asked.push(addressId)
    return answers[asked.length - 1]
  }
  return { send, asked }
}

const placed = order({ id: '00000000-0000-4000-8000-000000000704', number: 'SS-ABCDEFGH' })
const placeButton = () => screen.getByRole('button', { name: 'Place order (COD)' })

test('order placed', async () => {
  seed({ lines: [[taaza, 4]], storeOverrides: { minOrderCents: 9900 } })
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const asked: string[] = []
  // The answer waits at the gate, so the busy state from the press to the answer can be read.
  const send = async (addressId: string) => {
    asked.push(addressId)
    await gate
    return { order: placed }
  }
  const router = renderInRouter(<CheckoutPage send={send} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Place order (COD)' }))
  expect(placeButton()).toBeDisabled()
  expect(placeButton()).toHaveAttribute('aria-busy', 'true')
  release()
  await waitFor(() => expect(router.state.location.pathname).toBe(`/orders/${placed.id}`))
  expect(asked).toEqual([home.id])
  expect(queryClient.getQueryData(orderKey('t', placed.id))).toEqual(placed)
  expect(queryClient.getQueryData<CartView>(cartKey('t'))?.items).toEqual([])
})

test('order number collision retried once', async () => {
  const conflict: OrderResult = { error: { code: 'conflict', message: 'order number taken' } }
  seed({ lines: [[taaza, 4]], storeOverrides: { minOrderCents: 9900 } })
  const first = sender(conflict, { order: placed })
  const router = renderInRouter(<CheckoutPage send={first.send} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Place order (COD)' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(`/orders/${placed.id}`))
  expect(first.asked).toEqual([home.id, home.id])

  cleanup()
  seed({ lines: [[taaza, 4]], storeOverrides: { minOrderCents: 9900 } })
  const second = sender(conflict, conflict)
  const again = renderInRouter(<CheckoutPage send={second.send} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Place order (COD)' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not place your order. Try again.')
  expect(second.asked).toEqual([home.id, home.id])
  expect(again.state.location.pathname).toBe('/')
  expect(placeButton()).toBeEnabled()
})

test('cart already empty goes to orders', async () => {
  seed({ lines: [[taaza, 4]], storeOverrides: { minOrderCents: 9900 } })
  const { send } = sender({ error: { code: 'validation', message: 'cart is empty' } })
  const router = renderInRouter(<CheckoutPage send={send} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Place order (COD)' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/orders'))
  expect(queryClient.getQueryData<CartView>(cartKey('t'))?.items).toEqual([])
})

test('out-of-stock lines marked', async () => {
  const low = product({ quantity: 2 })
  const out = product({ id: '00000000-0000-4000-8000-000000000602', name: 'Amul Butter', slug: 'amul-butter', inStock: false, quantity: 0 })
  const curd = product({ id: '00000000-0000-4000-8000-000000000603', name: 'Amul Curd', slug: 'amul-curd', priceCents: 3000, mrpCents: 3000 })
  seed({
    lines: [
      [low, 3],
      [out, 1],
      [curd, 1],
    ],
  })
  const { send } = sender({
    error: { code: 'out_of_stock', message: 'short', productIds: [low.id, out.id] },
  })
  const router = renderInRouter(<CheckoutPage send={send} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Place order (COD)' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Some products are not available in the quantity you chose.')

  const summary = screen.getByRole('region', { name: 'Order summary' })
  const taazaLine = within(summary).getByText('Amul Taaza').closest('li') as HTMLElement
  expect(within(taazaLine).getByText('Only 2 left')).toBeInTheDocument()
  expect(within(taazaLine).getByRole('button', { name: 'Remove Amul Taaza' })).toBeInTheDocument()
  const butterLine = within(summary).getByText('Amul Butter').closest('li') as HTMLElement
  expect(within(butterLine).getByText('Out of stock')).toBeInTheDocument()
  expect(within(butterLine).getByRole('button', { name: 'Remove Amul Butter' })).toBeInTheDocument()
  const curdLine = within(summary).getByText('Amul Curd').closest('li') as HTMLElement
  expect(within(curdLine).queryByText(/Out of stock|Only|Not enough stock/)).toBeNull()
  expect(within(curdLine).queryByRole('button', { name: /Remove/ })).toBeNull()
  expect(router.state.location.pathname).toBe('/')
})

test('address not served', async () => {
  seed({ lines: [[taaza, 4]], addresses: [home, work], storeOverrides: { minOrderCents: 9900 } })
  const { send, asked } = sender({
    error: { code: 'not_serviceable', message: 'pincode not served', field: 'addressId' },
  })
  renderInRouter(<CheckoutPage send={send} />)
  const addresses = await screen.findByRole('region', { name: 'Delivery address' })
  await userEvent.click(within(addresses).getByRole('button', { name: 'Deliver to Work' }))
  await userEvent.click(placeButton())
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Koramangala does not deliver to this address. Choose another address or add one.',
  )
  expect(asked).toEqual([work.id])
  const badge = within(addresses).getByText('Not delivered here')
  expect(badge.closest('li')).toHaveTextContent('Work')
  expect(within(addresses).getAllByText('Not delivered here')).toHaveLength(1)
  expect(within(screen.getByRole('region', { name: 'Order summary' })).getByText('Amul Taaza')).toBeInTheDocument()
})

test('store closed at placement', async () => {
  seed({ lines: [[taaza, 4]], storeOverrides: { minOrderCents: 9900 } })
  const { send } = sender({ error: { code: 'not_serviceable', message: 'store closed' } })
  renderInRouter(<CheckoutPage send={send} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Place order (COD)' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Koramangala is closed right now.')
  expect(screen.queryByText('Not delivered here')).toBeNull()
})

test('placement fails', async () => {
  seed({ lines: [[taaza, 4]], storeOverrides: { minOrderCents: 9900 } })
  let calls = 0
  // The first answer is core's refusal; the second is the real request, which cannot reach core under jsdom.
  const send = async (addressId: string) => {
    calls += 1
    if (calls === 1) return { error: { code: 'validation', message: 'below minimum', field: 'subtotal' } } satisfies OrderResult
    return postOrder(addressId)
  }
  renderInRouter(<CheckoutPage send={send} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Place order (COD)' }))
  expect(await screen.findByRole('alert')).toHaveTextContent("Your cart is below the store's minimum order.")
  expect(placeButton()).toBeEnabled()
  expect(placeButton()).not.toHaveAttribute('aria-busy')

  await userEvent.click(placeButton())
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not place your order. Try again.'))
  expect(calls).toBe(2)
  expect(placeButton()).toBeEnabled()
  expect(placeButton()).not.toHaveAttribute('aria-busy')
})

test('choosing another address clears the refusal alert', async () => {
  seed({ lines: [[taaza, 4]], addresses: [home, work], storeOverrides: { minOrderCents: 9900 } })
  const { send } = sender({
    error: { code: 'not_serviceable', message: 'pincode not served', field: 'addressId' },
  })
  renderInRouter(<CheckoutPage send={send} />)
  const addresses = await screen.findByRole('region', { name: 'Delivery address' })
  await userEvent.click(within(addresses).getByRole('button', { name: 'Deliver to Work' }))
  await userEvent.click(placeButton())
  expect(await screen.findByRole('alert')).toHaveTextContent('does not deliver to this address')

  await userEvent.click(within(addresses).getByRole('button', { name: 'Deliver to Home' }))
  expect(screen.queryByRole('alert')).toBeNull()
  // The refused address keeps its badge until the next press or a fresh read of the list; the chosen one has none.
  const workItem = within(addresses).getByText('Work', { selector: 'h3' }).closest('li') as HTMLElement
  const homeItem = within(addresses).getByText('Home', { selector: 'h3' }).closest('li') as HTMLElement
  expect(within(workItem).getByText('Not delivered here')).toBeInTheDocument()
  expect(within(homeItem).queryByText('Not delivered here')).toBeNull()
})
