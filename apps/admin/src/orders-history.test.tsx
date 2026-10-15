import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, fakeCore, indiranagar, json, koramangala, storeList } from './fake-core'
import { listRequests, order, ordersCore, refreshFailed } from './orders-fake'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const asAdmin = { 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([indiranagar, koramangala]) }
const delivered = (n: number) => order(n, 'delivered', { placedAt: `2026-10-13T09:${String(n).padStart(2, '0')}:00Z`, deliveredAt: `2026-10-13T10:${String(n).padStart(2, '0')}:00Z` })
const cancelled = (n: number) => order(n, 'cancelled', { placedAt: `2026-10-12T09:${String(n).padStart(2, '0')}:00Z`, cancelledAt: `2026-10-12T09:${String(n + 2).padStart(2, '0')}:00Z`, cancelReason: 'Ordered by mistake' })
// Thirty delivered orders, SS-TEST0001 to SS-TEST0030: two pages of 24, the newest (0030) first.
const thirty = Array.from({ length: 30 }, (_, i) => delivered(i + 1))
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Orders' })).getByRole('link', { name })
const numbers = () => within(screen.getByRole('table', { name: 'Order history' })).getAllByRole('button').map((each) => each.textContent)
const last = (calls: Request[]) => listRequests(calls).at(-1)

test('the History tab lists delivered orders, newest first, with number, placed, customer, items, total and when delivered', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [delivered(1), delivered(2), cancelled(3), order(4, 'placed')]).routes })

  renderApp('/orders?tab=history')

  const table = await screen.findByRole('table', { name: 'Order history' })
  expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Order', 'Placed', 'Customer', 'Items', 'Total', 'Delivered'])
  const rows = within(table).getAllByRole('row').slice(1)
  expect(numbers()).toEqual(['SS-TEST0002', 'SS-TEST0001'])
  expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent?.replace(/^(Order|Placed|Customer|Items|Total|Delivered)/, ''))).toEqual([
    'SS-TEST0001',
    '13 Oct 2026, 2:31 pm',
    'Demo Customer',
    '4 items',
    '₹1,030',
    '13 Oct 2026, 3:31 pm',
  ])
  expect(screen.getByText('Page 1 of 1, 2 orders')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delivered' })).toHaveAttribute('aria-pressed', 'true')
  expect(tab('History')).toHaveAttribute('aria-current', 'page')
  expect(tab('Board')).not.toHaveAttribute('aria-current')
  expect(listRequests(calls)).toEqual([{ status: 'delivered', page: '1', pageSize: '24' }])
})

test('Board and History are tabs held in the URL, and the store stays chosen', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(koramangala.id, [delivered(1), order(2, 'placed')]).routes })

  const router = renderApp(`/orders?store=${koramangala.id}`)
  await screen.findByText('SS-TEST0002')
  expect(tab('Board')).toHaveAttribute('aria-current', 'page')
  expect(tab('History')).not.toHaveAttribute('aria-current')
  await userEvent.click(tab('History'))

  await screen.findByRole('table', { name: 'Order history' })
  expect(numbers()).toEqual(['SS-TEST0001'])
  expect(router.state.location.search).toEqual({ store: koramangala.id, tab: 'history' })
  expect(screen.queryByRole('region')).not.toBeInTheDocument()

  await userEvent.click(tab('Board'))
  expect(await screen.findByText('SS-TEST0002')).toBeInTheDocument()
  expect(router.state.location.search).toEqual({ store: koramangala.id })
  act(() => router.history.back())
  await screen.findByRole('table', { name: 'Order history' })
  expect(tab('History')).toHaveAttribute('aria-current', 'page')
})

test('Cancelled lists the cancelled orders with when they were cancelled, from page 1, never under the delivered rows', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [...thirty, cancelled(40)])
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  const router = renderApp('/orders?tab=history&page=2')
  await screen.findByText('Page 2 of 2, 30 orders')
  core.hold('lists')
  await userEvent.click(screen.getByRole('button', { name: 'Cancelled' }))

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cancelled' })).toHaveFocus()
  core.release('lists')
  const table = await screen.findByRole('table', { name: 'Order history' })
  expect(numbers()).toEqual(['SS-TEST0040'])
  expect(within(table).getAllByRole('columnheader').at(-1)).toHaveTextContent('Cancelled')
  expect(within(table).getAllByRole('row')[1]).toHaveTextContent('12 Oct 2026, 3:12 pm')
  expect(screen.getByRole('button', { name: 'Cancelled' })).toHaveAttribute('aria-pressed', 'true')
  expect(router.state.location.search).toEqual({ tab: 'history', status: 'cancelled' })
  // One request for the cancelled list, at page 1: the page of the delivered list is not carried over.
  expect(listRequests(calls).slice(1)).toEqual([{ status: 'cancelled', page: '1', pageSize: '24' }])

  await userEvent.click(screen.getByRole('button', { name: 'Delivered' }))
  await screen.findByText('Page 1 of 2, 30 orders')
  expect(router.state.location.search).toEqual({ tab: 'history' })
})

test('the pager moves between pages and keeps focus; rows kept while the next page loads are marked busy under their own page number', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, thirty)
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  const router = renderApp('/orders?tab=history')
  await screen.findByText('Page 1 of 2, 30 orders')
  expect(numbers()).toHaveLength(24)
  expect(numbers()[0]).toBe('SS-TEST0030')
  const previous = screen.getByRole('button', { name: 'Previous' })
  const next = screen.getByRole('button', { name: 'Next' })
  expect(previous).toHaveAttribute('aria-disabled', 'true')
  await userEvent.click(previous)
  expect(listRequests(calls)).toHaveLength(1)

  core.hold('lists')
  await userEvent.click(next)
  const busy = screen.getByRole('table', { name: 'Order history' }).closest('[aria-busy]')
  expect(busy).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByText('Page 1 of 2, 30 orders')).toBeInTheDocument()
  expect(numbers()[0]).toBe('SS-TEST0030')
  core.release('lists')

  await screen.findByText('Page 2 of 2, 30 orders')
  expect(numbers()).toEqual(['SS-TEST0006', 'SS-TEST0005', 'SS-TEST0004', 'SS-TEST0003', 'SS-TEST0002', 'SS-TEST0001'])
  expect(busy).toHaveAttribute('aria-busy', 'false')
  expect(next).toHaveFocus()
  expect(next).toHaveAttribute('aria-disabled', 'true')
  expect(next).toBeEnabled()
  expect(router.state.location.search).toEqual({ tab: 'history', page: 2 })
  expect(tab('History')).toHaveAttribute('aria-current', 'page')
  expect(tab('Board')).not.toHaveAttribute('aria-current')
  await userEvent.click(next)
  expect(listRequests(calls)).toHaveLength(2)
})

test.each([
  ['tab=archive', 'the board'],
  ['tab=history&status=placed', 'delivered orders'],
  ['tab=history&page=banana', 'page 1'],
  ['tab=history&page=0', 'page 1'],
  ['tab=history&page=1.5', 'page 1'],
])('?%s in the URL is read as %s', async (query, shown) => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [delivered(1), cancelled(2), order(3, 'placed')]).routes })

  renderApp(`/orders?${query}`)

  if (shown === 'the board') {
    expect(await screen.findByText('SS-TEST0003')).toBeInTheDocument()
    expect(tab('Board')).toHaveAttribute('aria-current', 'page')
  } else {
    await screen.findByRole('table', { name: 'Order history' })
    expect(numbers()).toEqual(['SS-TEST0001'])
    expect(last(calls)).toEqual({ status: 'delivered', page: '1', pageSize: '24' })
  }
})

test('a page in the URL beyond what core accepts is cut to one it does, then to the last page', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, thirty).routes })

  const router = renderApp('/orders?tab=history&page=2147483648')

  await screen.findByText('Page 2 of 2, 30 orders')
  expect(listRequests(calls).map((query) => query.page)).toEqual(['100000', '2'])
  expect(router.state.location.search).toEqual({ tab: 'history', page: 2 })
})

test('a history row opens the order without a cancel, read once and not polled', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [cancelled(1)]).routes })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  renderApp('/orders?tab=history&status=cancelled')
  await user.click(await screen.findByRole('button', { name: 'SS-TEST0001' }))

  const sheet = screen.getByRole('dialog', { name: 'Order SS-TEST0001' })
  expect(within(sheet).getByText('Reason for cancelling: Ordered by mistake')).toBeInTheDocument()
  expect(within(sheet).queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument()
  const read = () => calls.filter((call) => call.url.endsWith(`/admin/orders/${cancelled(1).id}`))
  await waitFor(() => expect(read()).toHaveLength(1))
  await act(() => vi.advanceTimersByTimeAsync(30_000))
  expect(read()).toHaveLength(1)
  expect(listRequests(calls)).toHaveLength(1)
})

test('a failed refresh keeps the history list; the next good answer shows what core then holds', async () => {
  setToken('tok')
  const orders = [delivered(1)]
  const core = ordersCore(indiranagar.id, orders)
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  const router = renderApp('/orders?tab=history')
  await screen.findByRole('table', { name: 'Order history' })
  core.fail('lists')
  orders.push(delivered(2))
  // Coming back to the tab asks core again.
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  await refreshFailed(router, ['admin', 'orders', indiranagar.id, 'history', 'delivered', 1])

  // The alert is for a list with nothing to show; this one keeps its rows. (The root of the app says a refresh failed.)
  expect(numbers()).toEqual(['SS-TEST0001'])
  expect(screen.getByText('Page 1 of 1, 1 orders')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('Could not refresh. Showing what was loaded last.')).toHaveAttribute('role', 'status')

  core.fail('lists', false)
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  await screen.findByText('Page 1 of 1, 2 orders')
  expect(numbers()).toEqual(['SS-TEST0002', 'SS-TEST0001'])
  expect(screen.queryByText('Could not refresh. Showing what was loaded last.')).not.toBeInTheDocument()
  expect(listRequests(calls)).toHaveLength(3)
})

test('the history shows a skeleton while loading, and a list that cannot be loaded offers a retry that reloads', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [delivered(1)])
  core.hold('lists')
  core.fail('lists')
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders?tab=history')

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Delivered' })).toBeInTheDocument()
  core.release('lists')
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the orders.')
  core.fail('lists', false)
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('table', { name: 'Order history' })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a store with no cancelled orders shows the empty state', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [delivered(1)]).routes })

  renderApp('/orders?tab=history&status=cancelled')

  expect(await screen.findByRole('heading', { level: 2, name: 'No cancelled orders' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument()
})

test('choosing a store on the History tab keeps the tab, starts at page 1 and never shows the other store\'s rows', async () => {
  setToken('tok')
  const other = ordersCore(koramangala.id, [delivered(40)])
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, thirty).routes, ...other.routes })

  const router = renderApp('/orders?tab=history&page=2')
  await screen.findByText('Page 2 of 2, 30 orders')
  other.hold('lists')
  await userEvent.selectOptions(screen.getByLabelText('Store'), koramangala.id)

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  other.release('lists')
  await screen.findByText('Page 1 of 1, 1 orders')
  expect(numbers()).toEqual(['SS-TEST0040'])
  expect(router.state.location.search).toEqual({ store: koramangala.id, tab: 'history' })
  // One request to each store: the other store is asked for page 1, not for the page left behind.
  expect(listRequests(calls).map((query) => query.page)).toEqual(['2', '1'])
})

test('a history page kept from before a status change is read again, never shown as it was', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'out_for_delivery')])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders?tab=history')
  expect(await screen.findByRole('heading', { level: 2, name: 'No delivered orders' })).toBeInTheDocument()
  await userEvent.click(tab('Board'))
  await userEvent.click(await screen.findByRole('button', { name: 'Mark delivered SS-TEST0001' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark delivered' }))
  await screen.findByText('SS-TEST0001 is now Delivered.')
  core.hold('lists')
  await userEvent.click(tab('History'))

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 2, name: 'No delivered orders' })).not.toBeInTheDocument()
  core.release('lists')
  await screen.findByRole('table', { name: 'Order history' })
  expect(numbers()).toEqual(['SS-TEST0001'])
})
