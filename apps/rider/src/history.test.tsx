import { screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { delivery, fakeApi, json, signedInRoutes } from './fake-api'
import { renderApp } from './render-app'

const listPath = '/api/rider/v1/me/deliveries'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

function list(items: ReturnType<typeof delivery>[], total = items.length) {
  return { items, page: 1, pageSize: 50, total }
}

test('delivered deliveries listed', async () => {
  setToken('tok')
  const done = delivery({
    id: '00000000-0000-4000-8000-000000000950',
    orderNumber: 'SS-DEMOAAAB',
    status: 'delivered',
    customerName: 'Demo Customer',
    address: { line1: '1 Demo Rd', pincode: '560034' },
    totalCents: 33900,
    deliveredAt: '2026-10-13T09:20:00.000Z',
  })
  const calls = fakeApi({
    ...signedInRoutes(),
    [`GET ${listPath}`]: () => json(200, list([done])),
  })

  renderApp('/history')

  expect(await screen.findByRole('heading', { level: 1, name: 'History' })).toBeInTheDocument()
  const table = await screen.findByRole('table', { name: 'Delivered deliveries' })
  const row = within(table).getByRole('row', { name: /SS-DEMOAAAB/ })
  expect(within(row).getByRole('link', { name: 'SS-DEMOAAAB' })).toHaveAttribute('href', `/deliveries/${done.id}`)
  expect(within(row).getByText('Demo Customer')).toBeInTheDocument()
  expect(within(row).getByText('560034')).toBeInTheDocument()
  expect(within(row).getByText('₹339')).toBeInTheDocument()
  expect(within(row).getByText('13 Oct 2026, 2:50 pm')).toBeInTheDocument()
  expect(screen.queryByText(/Showing the latest/)).not.toBeInTheDocument()

  const request = new URL(calls.find((call) => call.url.includes(listPath))!.url)
  expect(request.searchParams.get('status')).toBe('delivered')
  expect(request.searchParams.get('pageSize')).toBe('50')
})

test('no history', async () => {
  setToken('tok')
  fakeApi({ ...signedInRoutes(), [`GET ${listPath}`]: () => json(200, list([])) })

  renderApp('/history')

  expect(await screen.findByRole('heading', { level: 2, name: 'No deliveries yet' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test('more than one page', async () => {
  setToken('tok')
  const page = Array.from({ length: 50 }, (_, i) =>
    delivery({
      id: `00000000-0000-4000-8000-0000000009${String(i).padStart(2, '0')}`,
      orderNumber: `SS-HIST${String(i).padStart(4, '0')}`,
      status: 'delivered',
      deliveredAt: '2026-10-13T09:20:00.000Z',
    }),
  )
  const calls = fakeApi({ ...signedInRoutes(), [`GET ${listPath}`]: () => json(200, list(page, 51)) })

  renderApp('/history')

  const table = await screen.findByRole('table', { name: 'Delivered deliveries' })
  expect(within(table).getAllByRole('row')).toHaveLength(51)
  expect(screen.getByText('Showing the latest 50 of 51.')).toBeInTheDocument()
  const request = new URL(calls.find((call) => call.url.includes(listPath))!.url)
  expect(request.searchParams.get('status')).toBe('delivered')
  expect(request.searchParams.get('pageSize')).toBe('50')
})
