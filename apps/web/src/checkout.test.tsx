import { screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { queryClient } from './api'
import { cartKey } from './cart'
import { storeKey } from './cart-drawer'
import { keys } from './catalog'
import { cartView, type CartProduct } from './guest-cart'
import { setPincode } from './pincode'
import { setToken } from './session'
import { address, product, renderAt, store, type Address, type Store } from './test-data'

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
