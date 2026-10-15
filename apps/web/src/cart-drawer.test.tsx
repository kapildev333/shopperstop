import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { queryClient } from './api'
import { cartKey } from './cart'
import { openCart, storeKey } from './cart-drawer'
import { keys } from './catalog'
import { cartView, dispatchGuest, type CartProduct, type CartView } from './guest-cart'
import { setPincode } from './pincode'
import { setToken } from './session'
import { product, renderAt, store, type Store } from './test-data'

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
  const cart = { ...view, ...extra }
  setToken('t')
  queryClient.setQueryData(cartKey('t'), cart)
  return cart
}

// A token-held cart at Indiranagar that core answered as replaced, with the given old store (or none).
function seedReplaced(replacedStoreId?: string) {
  setPincode('560038')
  queryClient.setQueryData(keys.serviceability('560038'), store({ id: indiranagar, name: 'Indiranagar', promisedMinutes: 12 }))
  const cart = { ...cartView({ storeId: indiranagar, items: [{ product: taaza, quantity: 1 }] }, store({ id: indiranagar })), replaced: true, clamped: false, replacedStoreId }
  setToken('t')
  queryClient.setQueryData(cartKey('t'), cart)
  return cart
}

function setGuest(lines: [CartProduct, number][]) {
  act(() => {
    for (const [p, quantity] of lines) dispatchGuest({ type: 'set', storeId: koramangala, product: p, quantity })
  })
}

// The router loads the route asynchronously: the shell is there once its banner is.
async function renderShell() {
  renderAt('/')
  await screen.findByRole('banner')
}

function openDrawer() {
  act(() => openCart())
  return screen.getByRole('dialog', { name: 'Your cart' })
}

// The value beside a summary label: the dd after its dt.
function summary(drawer: HTMLElement, label: string) {
  return within(drawer).getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement
}

test('drawer lines and totals', async () => {
  resolveStore({ deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900 })
  setGuest([
    [taaza, 2],
    [butter, 1],
  ])
  await renderShell()
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

test('free delivery', async () => {
  resolveStore({ deliveryFeeCents: 2500, freeDeliveryAboveCents: 5000, minOrderCents: 1000 })
  setGuest([[taaza, 2]])
  await renderShell()
  const drawer = openDrawer()
  expect(summary(drawer, 'Delivery fee')).toHaveTextContent('Free')
  expect(within(drawer).queryByText(/more for free delivery/)).toBeNull()
})

test('checkout link signed in and out', async () => {
  resolveStore({ minOrderCents: 0 })
  setGuest([[taaza, 2]])
  await renderShell()
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

test('out-of-stock line', async () => {
  resolveStore()
  seedServerCart([[outOfStockButter, 1]])
  await renderShell()
  const drawer = openDrawer()
  expect(within(drawer).getByRole('button', { name: 'Out of stock' })).toBeDisabled()
  expect(within(drawer).getByRole('button', { name: 'Remove Amul Butter' })).toBeEnabled()
})

test('empty, loading and failed cart', async () => {
  resolveStore()
  await renderShell()
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

test('below the minimum order', async () => {
  resolveStore({ minOrderCents: 9900 })
  setGuest([[taaza, 2]])
  await renderShell()
  const drawer = openDrawer()
  expect(within(drawer).getByText('Minimum order is ₹99. Add ₹45 more to check out.')).toBeInTheDocument()
  expect(within(drawer).getByRole('button', { name: 'Proceed to checkout' })).toBeDisabled()
  expect(within(drawer).queryByRole('link', { name: 'Proceed to checkout' })).toBeNull()
})

test('bar and header follow the cart', async () => {
  resolveStore({ freeDeliveryAboveCents: 19900 })
  await renderShell()
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

test('no bar on checkout', async () => {
  seedServerCart([[taaza, 2]])
  renderAt('/checkout')
  // The header stays on every page; the bar is absent on /checkout, where the page has its own total.
  await screen.findByRole('banner')
  expect(screen.queryByRole('complementary', { name: 'Cart summary' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'View cart' })).toBeNull()
  expect(within(screen.getByRole('banner')).getByRole('button', { name: '2 items ₹54' })).toBeInTheDocument()
  expect(await screen.findByRole('heading', { level: 1, name: 'Checkout' })).toBeInTheDocument()
})

test('line clamped away', async () => {
  resolveStore()
  seedServerCart([], { clamped: true })
  await renderShell()
  const drawer = openDrawer()
  expect(within(drawer).getByText('Some quantities were lowered to what the store has.')).toBeInTheDocument()
  expect(within(drawer).getByText('Your cart is empty')).toBeInTheDocument()
})

test('quick taps in the drawer', async () => {
  resolveStore()
  seedServerCart([[taaza, 1]])
  await renderShell()
  const drawer = openDrawer()
  const group = () => within(drawer).getByRole('group', { name: 'Quantity of Amul Taaza' })
  // Synchronous taps, no answer awaited in between: each one counts from the last.
  fireEvent.click(within(drawer).getByRole('button', { name: 'Add one Amul Taaza' }))
  fireEvent.click(within(drawer).getByRole('button', { name: 'Add one Amul Taaza' }))
  expect(group()).toHaveTextContent(/^3$/)
  // Under jsdom every write fails: the drawer returns to the cart's count once the writes have settled.
  await waitFor(() => expect(group()).toHaveTextContent(/^1$/))
})

test('replaced notice names the old store', async () => {
  queryClient.setQueryData(storeKey(koramangala), store())
  seedReplaced(koramangala)
  await renderShell()
  // The answer opens the drawer by itself: nothing here calls openCart().
  const drawer = await screen.findByRole('dialog', { name: 'Your cart' })
  const notice = 'Your cart from Koramangala was replaced. A cart holds products from one store.'
  expect(within(drawer).getByText(notice)).toBeInTheDocument()
  expect(within(screen.getByRole('complementary', { name: 'Cart summary' })).getByText(notice)).toBeInTheDocument()
})

test('replaced notice without the old store', async () => {
  const cart = seedReplaced()
  await renderShell()
  const drawer = await screen.findByRole('dialog', { name: 'Your cart' })
  const notice = 'Your cart from another store was replaced. A cart holds products from one store.'
  expect(within(drawer).getByText(notice)).toBeInTheDocument()
  expect(within(screen.getByRole('complementary', { name: 'Cart summary' })).getByText(notice)).toBeInTheDocument()

  // A later answer without a replace shows no notice.
  // Query notifies its observers on a timer, so the change is awaited rather than read at once.
  act(() => queryClient.setQueryData(cartKey('t'), { ...cart, replaced: false }))
  await waitFor(() => expect(screen.queryByText(/was replaced/)).toBeNull())
})

test('replace opens the drawer once', async () => {
  resolveStore()
  const cart = seedServerCart([[taaza, 1]])
  await renderShell()
  expect(screen.queryByRole('dialog', { name: 'Your cart' })).toBeNull()

  act(() => queryClient.setQueryData(cartKey('t'), { ...cart, replaced: true, clamped: false }))
  const drawer = await screen.findByRole('dialog', { name: 'Your cart' })
  await userEvent.click(within(drawer).getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog', { name: 'Your cart' })).toBeNull()

  // A re-render with no new answer (the pincode's store changes) does not reopen it.
  act(() => queryClient.setQueryData(keys.serviceability('560034'), store({ promisedMinutes: 20 })))
  await screen.findByRole('button', { name: 'Delivery in 20 minutes 560034' })
  expect(screen.queryByRole('dialog', { name: 'Your cart' })).toBeNull()

  // A second replace, a new answer object with other content, opens it again.
  act(() =>
    queryClient.setQueryData(cartKey('t'), {
      ...cart,
      items: [{ product: taaza, quantity: 2 }],
      replaced: true,
      clamped: false,
    }),
  )
  const again = await screen.findByRole('dialog', { name: 'Your cart' })
  expect(within(again).getByRole('group', { name: 'Quantity of Amul Taaza' })).toHaveTextContent(/^2$/)
  await userEvent.click(within(again).getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog', { name: 'Your cart' })).toBeNull()

  // An answer with no replace does not open it again.
  act(() => queryClient.setQueryData(cartKey('t'), { ...cart, replaced: false, clamped: false }))
  await waitFor(() => expect(screen.queryByText(/was replaced/)).toBeNull())
  expect(screen.queryByRole('dialog', { name: 'Your cart' })).toBeNull()
})

// Pin from the 3a review: green on arrival.
test('clamp notice above the lines', async () => {
  resolveStore()
  seedServerCart([[taaza, 1]], { clamped: true })
  await renderShell()
  const drawer = openDrawer()
  const notice = within(drawer).getByText('Some quantities were lowered to what the store has.')
  const list = within(drawer).getByRole('list')
  expect(notice.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('failed write in the drawer', async () => {
  resolveStore()
  seedServerCart([[taaza, 1]])
  await renderShell()
  const drawer = openDrawer()
  fireEvent.click(within(drawer).getByRole('button', { name: 'Add one Amul Taaza' }))
  expect(await within(drawer).findByRole('alert')).toHaveTextContent('Could not reach ShopperStop. Try again.')
  expect(within(drawer).getByRole('group', { name: 'Quantity of Amul Taaza' })).toHaveTextContent(/^1$/)
  // Closing and reopening the drawer clears the failure: it lived in the line's state.
  await userEvent.click(within(drawer).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Your cart' })).toBeNull())
  const reopened = openDrawer()
  expect(within(reopened).queryByRole('alert')).toBeNull()
})
