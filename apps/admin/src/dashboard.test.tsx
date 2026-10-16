import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { components } from '@shopperstop/ui/api'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, indiranagar, json, koramangala, storeStaff } from './fake-core'
import { refreshFailed } from './orders-fake'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

type DashboardStore = components['schemas']['DashboardStore']
const quiet = { placed: 0, accepted: 0, packing: 0, ready: 0, out_for_delivery: 0, delivered: 0, cancelled: 0 }
const atIndiranagar: DashboardStore = { storeId: indiranagar.id, storeName: 'Indiranagar', ...{ isOpen: true }, ordersToday: quiet, lowStockCount: 1, revenueTodayCents: 0 }
const atKoramangala: DashboardStore = {
  storeId: koramangala.id,
  storeName: 'Koramangala',
  ...{ isOpen: true },
  ordersToday: { placed: 1, accepted: 2, packing: 3, ready: 4, out_for_delivery: 5, delivered: 6, cancelled: 7 },
  lowStockCount: 20,
  revenueTodayCents: 618050,
}
const asAdmin = { 'GET /admin/me': () => json(200, admin) }
const card = (name: string) => screen.findByRole('region', { name })
// The card's figures as "label: value" lines.
const figures = (region: HTMLElement) => {
  const terms = within(region).getAllByRole('term').map((term) => term.textContent)
  return within(region).getAllByRole('definition').map((value, i) => `${terms[i]}: ${value.textContent}`)
}

test('an admin sees a card per store in core\'s order, with today\'s orders by status and in all, revenue and the low-stock count', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, 'GET /admin/dashboard': () => json(200, { items: [atIndiranagar, atKoramangala] }) })

  renderApp('/')

  expect(figures(await card('Koramangala'))).toEqual([
    'Orders today: 28',
    'Placed: 1',
    'Accepted: 2',
    'Packing: 3',
    'Ready: 4',
    'Out for delivery: 5',
    'Delivered: 6',
    'Cancelled: 7',
    'Revenue today: ₹6,180.50',
    'Low stock: 20 products',
  ])
  expect(figures(await card('Indiranagar')).filter((line) => !line.endsWith(': 0'))).toEqual(['Revenue today: ₹0', 'Low stock: 1 product'])
  expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Indiranagar', 'Koramangala'])
  expect(calls.map((call) => new URL(call.url).pathname.replace('/api/core/v1', ''))).toEqual(['/admin/me', '/admin/dashboard'])
})

test('a card links to its store\'s orders and to its stock filtered to low stock', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, 'GET /admin/dashboard': () => json(200, { items: [atIndiranagar, atKoramangala] }) })

  const router = renderApp('/')
  const region = await card('Koramangala')

  expect(within(region).getByRole('link', { name: 'Orders at Koramangala' })).toHaveAttribute('href', `/orders?store=${koramangala.id}`)
  expect(within(region).getByRole('link', { name: 'Low stock at Koramangala' })).toHaveAttribute('href', `/stock?store=${koramangala.id}&lowStock=true`)
  await userEvent.click(within(region).getByRole('link', { name: 'Low stock at Koramangala' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/stock'))
  expect(router.state.location.search).toEqual({ store: koramangala.id, lowStock: true })
})

test('store staff see the one card core gives them, for their own store', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => json(200, storeStaff), 'GET /admin/dashboard': () => json(200, { items: [{ ...atKoramangala, storeId: storeStaff.storeId }] }) })

  renderApp('/')

  expect(await card('Koramangala')).toBeInTheDocument()
  expect(screen.getAllByRole('region')).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'Low stock at Koramangala' })).toHaveAttribute('href', `/stock?store=${storeStaff.storeId}&lowStock=true`)
})

test('the dashboard shows a skeleton while loading', async () => {
  setToken('tok')
  let release = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  fakeCore({
    ...asAdmin,
    'GET /admin/dashboard': async () => {
      await held
      return json(200, { items: [atKoramangala] })
    },
  })

  renderApp('/')

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  release()
  expect(await card('Koramangala')).toBeInTheDocument()
})

test('a dashboard that cannot be loaded offers a retry that reloads', async () => {
  setToken('tok')
  let fail = true
  fakeCore({ ...asAdmin, 'GET /admin/dashboard': () => (fail ? apiError(500, 'internal') : json(200, { items: [atKoramangala] })) })

  renderApp('/')

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the dashboard.')
  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await card('Koramangala')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a failed refresh keeps the cards; the next good answer shows the new numbers', async () => {
  setToken('tok')
  let answer = () => json(200, { items: [atKoramangala] })
  fakeCore({ ...asAdmin, 'GET /admin/dashboard': () => answer() })

  const router = renderApp('/')
  await card('Koramangala')
  answer = () => apiError(500, 'internal')
  // Coming back to the tab asks core again.
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  await refreshFailed(router, ['admin', 'dashboard'])

  // The alert is for a dashboard with nothing to show; this one keeps its card. (The root of the app says a refresh failed.)
  expect(figures(screen.getByRole('region', { name: 'Koramangala' }))).toContain('Orders today: 28')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('Could not refresh. Showing what was loaded last.')).toHaveAttribute('role', 'status')

  answer = () => json(200, { items: [{ ...atKoramangala, ordersToday: { ...atKoramangala.ordersToday, placed: 2 } }] })
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  await waitFor(() => expect(figures(screen.getByRole('region', { name: 'Koramangala' }))).toContain('Orders today: 29'))
  expect(screen.queryByText('Could not refresh. Showing what was loaded last.')).not.toBeInTheDocument()
})

test('an admin with no stores is told to create one', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, 'GET /admin/dashboard': () => json(200, { items: [] }) })

  renderApp('/')

  expect(await screen.findByRole('heading', { level: 2, name: 'No stores yet' })).toBeInTheDocument()
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
})
