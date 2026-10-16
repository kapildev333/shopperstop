import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, indiranagar, json, koramangala, storeList, storeStaff } from './fake-core'
import { listRequests, order, ordersCore, refreshFailed } from './orders-fake'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const asAdmin = { 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([indiranagar, koramangala]) }
const column = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`) })
const news = () => screen.getByRole('status', { name: 'New orders' })

// Fake timers for one test, for the 10 s poll. `shouldAdvanceTime` lets the fake clock also run with the real one, so
// Testing Library's `findBy` and `waitFor` (which wait on timers) keep working; `poll()` jumps the clock one interval.
function useFakeClock() {
  vi.useFakeTimers({ shouldAdvanceTime: true })
}
const poll = (ms = 10_000) => act(() => vi.advanceTimersByTimeAsync(ms))

test('the board shows a column per active status with each order\'s number, time since placed, item count, total and pincode', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [
    order(1, 'placed'),
    order(2, 'placed', { address: { label: 'Work', line1: '100 Feet Rd', pincode: '560038' }, totalCents: 4550, items: [{ productId: '00000000-0000-4000-8000-000000000601', name: 'Banana Robusta', unitLabel: '1 kg', priceCents: 4550, mrpCents: 7000, quantity: 1 }] }),
    order(3, 'accepted'),
    order(4, 'out_for_delivery', { placedAt: new Date(Date.now() - 125 * 60_000).toISOString() }),
    order(5, 'delivered'),
    order(6, 'cancelled'),
  ])
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')

  expect(await screen.findByRole('heading', { level: 2, name: /^Placed/ })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Placed2', 'Accepted1', 'Packing0', 'Ready0', 'Out for delivery1'])
  // The longest waiting order is first in its column.
  const placed = within(column('Placed')).getAllByRole('listitem')
  expect(placed.map((card) => within(card).getByText(/^SS-/).textContent)).toEqual(['SS-TEST0002', 'SS-TEST0001'])
  expect(placed[0]).toHaveTextContent('2 min ago')
  expect(placed[0]).toHaveTextContent('1 item, pincode 560038')
  expect(placed[0]).toHaveTextContent('₹45.50')
  expect(placed[1]).toHaveTextContent('1 min ago')
  expect(placed[1]).toHaveTextContent('4 items, pincode 560034')
  expect(placed[1]).toHaveTextContent('₹1,030')
  expect(within(column('Out for delivery')).getByRole('listitem')).toHaveTextContent('2 h 5 min ago')
  expect(within(column('Packing')).getByText('No orders')).toBeInTheDocument()
  expect(screen.queryByText('SS-TEST0005')).not.toBeInTheDocument()
  expect(screen.queryByText('SS-TEST0006')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(indiranagar.id)
  // One request for every active order, the largest page core gives.
  expect(listRequests(calls)).toEqual([{ active: 'true', pageSize: '100' }])
  expect(screen.queryByText(/^Showing the newest/)).not.toBeInTheDocument()
})

test('store staff see the board of their own store by name, with no store selector and no stores request', async () => {
  setToken('tok')
  const own = storeStaff.storeId!
  const calls = fakeCore({
    'GET /admin/me': () => json(200, storeStaff),
    [`GET /stores/${own}`]: () => json(200, { id: own, name: 'Whitefield', isOpen: true, deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900, promisedMinutes: 10 }),
    ...ordersCore(own, [order(1, 'placed', { storeId: own })]).routes,
  })

  renderApp(`/orders?store=${koramangala.id}`)

  expect(await screen.findByText('SS-TEST0001')).toBeInTheDocument()
  expect(await screen.findByText('Whitefield')).toBeInTheDocument()
  expect(screen.queryByLabelText('Store')).not.toBeInTheDocument()
  expect([...new Set(calls.map((call) => new URL(call.url).pathname.replace('/api/core/v1', '')))].sort()).toEqual(['/admin/me', `/admin/stores/${own}/orders`, `/stores/${own}`])
})

test('store staff get the board without a store name when the name cannot be read', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => json(200, storeStaff), ...ordersCore(storeStaff.storeId!, [order(1, 'placed', { storeId: storeStaff.storeId })]).routes })

  renderApp('/orders')

  expect(await screen.findByText('SS-TEST0001')).toBeInTheDocument()
  expect(screen.queryByText(/^Store:/)).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a store in the URL is the one shown, and one that is not a store shows the first store', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'placed')]).routes, ...ordersCore(koramangala.id, [order(2, 'placed', { storeId: koramangala.id })]).routes })

  const router = renderApp(`/orders?store=${koramangala.id}`)
  expect(await screen.findByText('SS-TEST0002')).toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(koramangala.id)

  await act(() => router.navigate({ to: '/orders', search: { store: 'nope' } }))
  expect(await screen.findByText('SS-TEST0001')).toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(indiranagar.id)
})

test('choosing a store puts it in the URL and never shows or announces the other store\'s orders', async () => {
  setToken('tok')
  const other = ordersCore(koramangala.id, [order(2, 'placed', { storeId: koramangala.id })])
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'placed')]).routes, ...other.routes })

  const router = renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  other.hold('lists')
  await userEvent.selectOptions(screen.getByLabelText('Store'), koramangala.id)

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.queryByText('SS-TEST0001')).not.toBeInTheDocument()
  other.release('lists')
  expect(await screen.findByText('SS-TEST0002')).toBeInTheDocument()
  // The orders the other store already had are not new orders.
  expect(news()).toBeEmptyDOMElement()
  expect(screen.getByLabelText('Store')).toHaveFocus()
  expect(router.state.location.search).toEqual({ store: koramangala.id })
})

test('the board asks core again every 10 seconds and shows an order where it now stands', async () => {
  useFakeClock()
  setToken('tok')
  const orders = [order(1, 'placed')]
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, orders).routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  expect(within(column('Placed')).getByText('SS-TEST0001')).toBeInTheDocument()
  expect(listRequests(calls)).toHaveLength(1)

  // Another staff member accepts it.
  orders[0] = { ...orders[0], status: 'accepted' }
  await poll(9_000)
  expect(listRequests(calls)).toHaveLength(1)
  await poll(1_000)
  expect(listRequests(calls)).toHaveLength(2)
  await waitFor(() => expect(within(column('Accepted')).getByText('SS-TEST0001')).toBeInTheDocument())
  expect(within(column('Placed')).getByText('No orders')).toBeInTheDocument()
})

test('a newly placed order is announced once; the first load, an unchanged answer and an order in another status announce nothing', async () => {
  useFakeClock()
  setToken('tok')
  const orders = [order(1, 'placed')]
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, orders).routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  expect(news()).toBeEmptyDOMElement()
  expect(news()).toHaveClass('sr-only')

  orders.push(order(2, 'placed'), order(3, 'accepted'))
  await poll()
  await waitFor(() => expect(news()).toHaveTextContent(/^New order SS-TEST0002$/))
  expect(screen.getByText('SS-TEST0003')).toBeInTheDocument()

  // The same answer again: the region is not written again, so nothing is read out twice.
  const written = vi.fn()
  const observer = new MutationObserver(written)
  observer.observe(news(), { childList: true, characterData: true, subtree: true })
  await poll()
  await poll()
  expect(news()).toHaveTextContent(/^New order SS-TEST0002$/)
  expect(written).not.toHaveBeenCalled()
  observer.disconnect()

  // A changed answer with no new order empties the region, ready for the next news.
  orders[2] = { ...orders[2], status: 'packing' }
  await poll()
  await waitFor(() => expect(news()).toBeEmptyDOMElement())

  orders.push(order(4, 'placed'), order(5, 'placed'))
  await poll()
  await waitFor(() => expect(news()).toHaveTextContent(/^2 new orders: SS-TEST0004, SS-TEST0005$/))
})

test('a hidden tab is not polled, and showing it again asks core at once', async () => {
  useFakeClock()
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'placed')]).routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  await poll(30_000)
  expect(listRequests(calls)).toHaveLength(1)

  visibility.mockReturnValue('visible')
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  await waitFor(() => expect(listRequests(calls)).toHaveLength(2))
})

test('a failed poll keeps the board and announces nothing; the next good answer shows and announces what is new', async () => {
  useFakeClock()
  setToken('tok')
  const orders = [order(1, 'placed')]
  const core = ordersCore(indiranagar.id, orders)
  fakeCore({ ...asAdmin, ...core.routes })

  const router = renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  core.fail('lists')
  orders.push(order(2, 'placed'))
  await poll()
  await refreshFailed(router, ['admin', 'orders', indiranagar.id, 'board'])

  // The alert is for a board with nothing to show; this one keeps its order. (The root of the app says a refresh failed.)
  expect(screen.getByText('SS-TEST0001')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: /^Placed/ })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('Could not refresh. Showing what was loaded last.')).toHaveAttribute('role', 'status')
  expect(screen.queryByText('SS-TEST0002')).not.toBeInTheDocument()
  expect(news()).toBeEmptyDOMElement()

  core.fail('lists', false)
  await poll()
  expect(await screen.findByText('SS-TEST0002')).toBeInTheDocument()
  expect(screen.queryByText('Could not refresh. Showing what was loaded last.')).not.toBeInTheDocument()
  expect(news()).toHaveTextContent(/^New order SS-TEST0002$/)
})

test('the time since placed moves on without core being asked', async () => {
  useFakeClock()
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(3, 'placed')]).routes })

  renderApp('/orders')
  expect(await screen.findByText('3 min ago')).toBeInTheDocument()
  const asked = calls.length
  await poll(9_000)
  expect(calls).toHaveLength(asked)
  await poll(56_000)
  expect(screen.getByText('4 min ago')).toBeInTheDocument()
})

test('the board shows a skeleton while loading', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'placed')])
  core.hold('lists')
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(await screen.findByLabelText('Store')).toHaveValue(indiranagar.id)
  core.release('lists')
  expect(await screen.findByText('SS-TEST0001')).toBeInTheDocument()
})

test('a board that cannot be loaded offers a retry that reloads', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'placed')])
  core.fail('lists')
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the orders.')
  core.fail('lists', false)
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('SS-TEST0001')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a store with no active orders shows the empty state', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(5, 'delivered')]).routes })

  renderApp('/orders')

  expect(await screen.findByRole('heading', { level: 2, name: 'No active orders' })).toBeInTheDocument()
  expect(news()).toBeEmptyDOMElement()
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
})

test('an admin with no stores is told to create one', async () => {
  setToken('tok')
  const calls = fakeCore({ 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([]) })

  renderApp('/orders')

  expect(await screen.findByRole('heading', { level: 2, name: 'No stores yet' })).toBeInTheDocument()
  expect(listRequests(calls)).toEqual([])
})

test('stores that cannot be loaded offer a retry that reloads', async () => {
  setToken('tok')
  let fail = true
  fakeCore({
    'GET /admin/me': () => json(200, admin),
    'GET /admin/stores': () => (fail ? apiError(500, 'internal') : storeList([indiranagar])),
    ...ordersCore(indiranagar.id, [order(1, 'placed')]).routes,
  })

  renderApp('/orders')

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the stores.')
  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('SS-TEST0001')).toBeInTheDocument()
})

test('coming back to a store announces nothing for an order placed while its board was away', async () => {
  useFakeClock()
  setToken('tok')
  const orders = [order(1, 'placed')]
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, orders).routes, ...ordersCore(koramangala.id, [order(9, 'placed', { storeId: koramangala.id })]).routes })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await user.selectOptions(screen.getByLabelText('Store'), koramangala.id)
  await screen.findByText('SS-TEST0009')
  orders.push(order(2, 'placed'))
  await user.selectOptions(screen.getByLabelText('Store'), indiranagar.id)

  // The orders kept from the first visit show at once; the order placed since then arrives with the board's first answer.
  expect(await screen.findByText('SS-TEST0002')).toBeInTheDocument()
  expect(news()).toBeEmptyDOMElement()
  // From here on the board is open, and a new order is news.
  orders.push(order(3, 'placed'))
  await poll()
  await waitFor(() => expect(news()).toHaveTextContent(/^New order SS-TEST0003$/))
})

test('leaving the orders page and coming back announces nothing for an order placed meanwhile', async () => {
  setToken('tok')
  const orders = [order(1, 'placed')]
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, orders).routes })

  const router = renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await act(() => router.navigate({ to: '/' }))
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
  orders.push(order(2, 'placed'))
  await act(() => router.navigate({ to: '/orders' }))

  expect(await screen.findByText('SS-TEST0002')).toBeInTheDocument()
  expect(news()).toBeEmptyDOMElement()
})

test('orders kept from an earlier visit are no baseline when the first refresh after coming back fails', async () => {
  useFakeClock()
  setToken('tok')
  const orders = [order(1, 'placed')]
  const core = ordersCore(indiranagar.id, orders)
  fakeCore({ ...asAdmin, ...core.routes })

  const router = renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await act(() => router.navigate({ to: '/' }))
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
  orders.push(order(2, 'placed'))
  core.fail('lists')
  await act(() => router.navigate({ to: '/orders' }))
  await screen.findByText('SS-TEST0001')
  await refreshFailed(router, ['admin', 'orders', indiranagar.id, 'board'])

  core.fail('lists', false)
  await poll()
  expect(await screen.findByText('SS-TEST0002')).toBeInTheDocument()
  expect(news()).toBeEmptyDOMElement()
})

test('an order placed while the tab was hidden is announced when the tab shows again', async () => {
  useFakeClock()
  setToken('tok')
  const orders = [order(1, 'placed')]
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, orders).routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  orders.push(order(2, 'placed'))
  await poll(30_000)
  expect(news()).toBeEmptyDOMElement()

  // The board stayed open: what came in while nobody looked is news.
  visibility.mockReturnValue('visible')
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  await waitFor(() => expect(news()).toHaveTextContent(/^New order SS-TEST0002$/))
})

test('cards are in the order the orders were placed, also within one second and whatever the digits core trimmed', async () => {
  setToken('tok')
  // As core writes them: no fraction, ".5" and ".501" of the same second. As strings they sort 3, 2, 1.
  fakeCore({
    ...asAdmin,
    ...ordersCore(indiranagar.id, [
      order(1, 'placed', { placedAt: '2026-10-13T09:20:00Z' }),
      order(2, 'placed', { placedAt: '2026-10-13T09:20:00.5Z' }),
      order(3, 'placed', { placedAt: '2026-10-13T09:20:00.501Z' }),
    ]).routes,
  })

  renderApp('/orders')

  await screen.findByText('SS-TEST0001')
  expect(within(column('Placed')).getAllByRole('listitem').map((card) => within(card).getByText(/^SS-/).textContent)).toEqual(['SS-TEST0001', 'SS-TEST0002', 'SS-TEST0003'])
})

test('a column is named by its status and how many orders it holds', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'placed'), order(2, 'placed'), order(3, 'accepted')]).routes })

  renderApp('/orders')

  await screen.findByText('SS-TEST0001')
  expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.getAttribute('aria-label'))).toEqual(['Placed, 2 orders', 'Accepted, 1 order', 'Packing, 0 orders', 'Ready, 0 orders', 'Out for delivery, 0 orders'])
  expect(within(screen.getByRole('region', { name: 'Accepted, 1 order' })).getByText('SS-TEST0003')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Placed, 2 orders' })).toHaveTextContent(/^Placed2$/)
})

test('the one list failing on a later poll keeps the whole board, with the notice that it could not refresh', async () => {
  useFakeClock()
  setToken('tok')
  const orders = [order(1, 'placed'), order(2, 'ready')]
  const core = ordersCore(indiranagar.id, orders)
  fakeCore({ ...asAdmin, ...core.routes })

  const router = renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  // The placed order is accepted elsewhere, and core cannot list the active orders.
  orders[0] = { ...orders[0], status: 'accepted' }
  core.fail('lists')
  await poll()
  await refreshFailed(router, ['admin', 'orders', indiranagar.id, 'board'])

  expect(within(column('Placed')).getByText('SS-TEST0001')).toBeInTheDocument()
  expect(within(column('Ready')).getByText('SS-TEST0002')).toBeInTheDocument()
  expect(within(column('Accepted')).getByText('No orders')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('Could not refresh. Showing what was loaded last.')).toHaveAttribute('role', 'status')
})

test('the one list failing on the first load is a board that could not be loaded', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'placed')])
  core.fail('lists')
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the orders.')
  expect(screen.queryByText('SS-TEST0001')).not.toBeInTheDocument()
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
})

test('the poll stops when the board is left', async () => {
  useFakeClock()
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'placed')]).routes })

  const router = renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await poll()
  expect(listRequests(calls)).toHaveLength(2)
  await act(() => router.navigate({ to: '/' }))
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
  await poll(30_000)

  expect(listRequests(calls)).toHaveLength(2)
})

test('a card taken out by a rider names the rider; a card without one does not', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'ready'), order(2, 'out_for_delivery', { riderName: 'Arjun Rao' }), order(3, 'out_for_delivery')]).routes })

  renderApp('/orders')

  const out = within(await screen.findByRole('region', { name: /^Out for delivery/ })).getAllByRole('listitem')
  expect(out[0]).toHaveTextContent('SS-TEST0003')
  expect(out[0]).not.toHaveTextContent('Rider')
  expect(out[1]).toHaveTextContent('Rider: Arjun Rao')
  expect(within(column('Ready')).getByRole('listitem')).not.toHaveTextContent('Rider')
})

test('a store with more active orders than one page says how many the board shows', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, [`GET /admin/stores/${indiranagar.id}/orders`]: () => json(200, { items: [order(1, 'placed')], page: 1, pageSize: 100, total: 130 }) })

  renderApp('/orders')

  expect(await screen.findByText('Showing the newest 1 of 130 active orders.')).toHaveAttribute('role', 'status')
  expect(screen.getByText('SS-TEST0001')).toBeInTheDocument()
})

test('each card carries its payment as a badge: cash on delivery, awaiting payment, paid', async () => {
  setToken('tok')
  fakeCore({
    ...asAdmin,
    ...ordersCore(indiranagar.id, [
      order(1, 'placed'),
      order(2, 'placed', { paymentMethod: 'online', paymentStatus: 'pending' }),
      order(3, 'accepted', { paymentMethod: 'online', paymentStatus: 'paid', paymentReference: 'pay_123' }),
    ]).routes,
  })

  renderApp('/orders')

  const placed = within(await screen.findByRole('region', { name: /^Placed/ })).getAllByRole('listitem')
  // D53: cash is neutral, a pending payment the one warning, a paid one success; the badge always says it in words.
  expect(within(placed[0]).getByText('Awaiting payment')).toHaveClass('bg-warning-soft')
  expect(within(placed[1]).getByText('Cash on delivery')).toHaveClass('bg-canvas')
  expect(within(column('Accepted')).getByText('Paid')).toHaveClass('bg-success-soft')
})
