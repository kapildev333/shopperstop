import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { queryClient } from './api'
import { cartKey } from './cart'
import { openCart } from './cart-drawer'
import { keys } from './catalog'
import { cartView, dispatchGuest, type CartProduct, type CartView } from './guest-cart'
import { setPincode } from './pincode'
import { setToken } from './session'
import { product, renderAt, store, type Store } from './test-data'

const koramangala = '00000000-0000-4000-8000-000000000401'
const taaza = product()
const butter = product({
  id: '00000000-0000-4000-8000-000000000602',
  name: 'Amul Butter',
  slug: 'amul-butter',
  unitLabel: '100 g',
  priceCents: 5600,
  mrpCents: 5600,
})
const outOfStockButter: CartProduct = { ...butter, inStock: false, quantity: 0 }

// Resolves 560034 to Koramangala with the given fees; the drawer prices a guest cart with them.
function resolveStore(overrides: Partial<Store> = {}) {
  setPincode('560034')
  queryClient.setQueryData(keys.serviceability('560034'), store(overrides))
}

// Signed in, with the server cart seeded (no HTTP): totals are priced with the same fees as the store.
function seedServerCart(lines: [CartProduct, number][], extra: Partial<CartView> = {}) {
  const view = cartView(
    { storeId: koramangala, items: lines.map(([p, quantity]) => ({ product: p, quantity })) },
    store(),
  )
  setToken('t')
  queryClient.setQueryData(cartKey('t'), { ...view, ...extra })
}

function setGuest(lines: [CartProduct, number][]) {
  act(() => {
    for (const [p, quantity] of lines) dispatchGuest({ type: 'set', storeId: koramangala, product: p, quantity })
  })
}

function openDrawer() {
  act(() => openCart())
  return screen.getByRole('dialog', { name: 'Your cart' })
}

// The value beside a summary label: the dd after its dt.
function summary(drawer: HTMLElement, label: string) {
  return within(drawer).getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement
}

test('drawer lines and totals', () => {
  resolveStore({ deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900 })
  setGuest([
    [taaza, 2],
    [butter, 1],
  ])
  renderAt('/')
  const drawer = openDrawer()
  expect(within(drawer).getByText('Amul Taaza')).toBeInTheDocument()
  expect(within(drawer).getByText('500 ml')).toBeInTheDocument()
  expect(within(drawer).getByText('Amul Butter')).toBeInTheDocument()
  expect(within(drawer).getByText('100 g')).toBeInTheDocument()
  expect(within(drawer).getByRole('group', { name: 'Quantity of Amul Taaza' })).toHaveTextContent(/^2$/)
  expect(within(drawer).getByRole('group', { name: 'Quantity of Amul Butter' })).toHaveTextContent(/^1$/)
  expect(summary(drawer, 'Subtotal')).toHaveTextContent('₹110')
  expect(summary(drawer, 'Delivery fee')).toHaveTextContent('₹25')
  expect(summary(drawer, 'Total')).toHaveTextContent('₹135')
  expect(within(drawer).getByText('Add ₹89 more for free delivery')).toBeInTheDocument()
  expect(within(drawer).getByRole('link', { name: 'Proceed to checkout' })).toBeInTheDocument()
})

test('free delivery', () => {
  resolveStore({ deliveryFeeCents: 2500, freeDeliveryAboveCents: 5000, minOrderCents: 1000 })
  setGuest([[taaza, 2]])
  renderAt('/')
  const drawer = openDrawer()
  expect(summary(drawer, 'Delivery fee')).toHaveTextContent('Free')
  expect(within(drawer).queryByText(/more for free delivery/)).toBeNull()
})

test('checkout link signed in and out', () => {
  resolveStore({ minOrderCents: 0 })
  setGuest([[taaza, 2]])
  renderAt('/')
  const drawer = openDrawer()
  expect(within(drawer).getByRole('link', { name: 'Proceed to checkout' })).toHaveAttribute(
    'href',
    '/sign-in?returnTo=%2Fcheckout',
  )
  act(() => {
    seedServerCart([[taaza, 2]])
  })
  expect(within(drawer).getByRole('link', { name: 'Proceed to checkout' })).toHaveAttribute('href', '/checkout')
})

test('out-of-stock line', () => {
  resolveStore()
  seedServerCart([[outOfStockButter, 1]])
  renderAt('/')
  const drawer = openDrawer()
  expect(within(drawer).getByRole('button', { name: 'Out of stock' })).toBeDisabled()
  expect(within(drawer).getByRole('button', { name: 'Remove Amul Butter' })).toBeEnabled()
})

test('empty, loading and failed cart', async () => {
  resolveStore()
  renderAt('/')
  const drawer = openDrawer()
  expect(within(drawer).getByText('Your cart is empty')).toBeInTheDocument()
  // Signed in with no cart cached: the request is made and fails under jsdom; the loading state shows first.
  act(() => {
    setToken('t')
  })
  expect(within(drawer).getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(await within(drawer).findByRole('alert')).toHaveTextContent('Could not load your cart.')
  expect(within(drawer).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

test('below the minimum order', () => {
  resolveStore({ minOrderCents: 9900 })
  setGuest([[taaza, 2]])
  renderAt('/')
  const drawer = openDrawer()
  expect(within(drawer).getByText('Minimum order is ₹99. Add ₹45 more to check out.')).toBeInTheDocument()
  expect(within(drawer).getByRole('button', { name: 'Proceed to checkout' })).toBeDisabled()
  expect(within(drawer).queryByRole('link', { name: 'Proceed to checkout' })).toBeNull()
})

test('bar and header follow the cart', async () => {
  resolveStore({ freeDeliveryAboveCents: 19900 })
  renderAt('/')
  const banner = within(screen.getByRole('banner'))
  expect(screen.queryByRole('button', { name: 'View cart' })).toBeNull()
  expect(banner.getByRole('button', { name: 'Cart' })).toBeInTheDocument()

  // Two of a 2700 product at a 2500 fee: the bar and the header button both read 79 rupees.
  setGuest([[taaza, 2]])
  const bar = screen.getByRole('complementary', { name: 'Cart summary' })
  expect(within(bar).getByText('2 items')).toBeInTheDocument()
  expect(within(bar).getByText('₹79')).toBeInTheDocument()
  expect(banner.getByRole('button', { name: '2 items ₹79' })).toBeInTheDocument()

  await userEvent.click(within(bar).getByRole('button', { name: 'View cart' }))
  expect(screen.getByRole('dialog', { name: 'Your cart' })).toBeInTheDocument()
})

test('line clamped away', () => {
  resolveStore()
  seedServerCart([], { clamped: true })
  renderAt('/')
  const drawer = openDrawer()
  expect(within(drawer).getByText('Some quantities were lowered to what the store has.')).toBeInTheDocument()
  expect(within(drawer).getByText('Your cart is empty')).toBeInTheDocument()
})

test('quick taps in the drawer', async () => {
  resolveStore()
  seedServerCart([[taaza, 1]])
  renderAt('/')
  const drawer = openDrawer()
  const group = () => within(drawer).getByRole('group', { name: 'Quantity of Amul Taaza' })
  // Synchronous taps, no answer awaited in between: each one counts from the last.
  fireEvent.click(within(drawer).getByRole('button', { name: 'Add one Amul Taaza' }))
  fireEvent.click(within(drawer).getByRole('button', { name: 'Add one Amul Taaza' }))
  expect(group()).toHaveTextContent(/^3$/)
  // Under jsdom every write fails: the drawer returns to the cart's count once the writes have settled.
  await waitFor(() => expect(group()).toHaveTextContent(/^1$/))
})
