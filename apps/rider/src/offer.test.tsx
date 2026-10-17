import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { arjun, fakeApi, json, offer, signedInRoutes } from './fake-api'
import { fakeGeolocation } from './fake-geolocation'
import { renderApp } from './render-app'

type Routes = Parameters<typeof fakeApi>[0]

const READY = 'GET /api/rider/v1/me/ready-orders'
const DELIVERIES = 'GET /api/rider/v1/me/deliveries'
const LOCATION = 'PUT /api/rider/v1/me/location'
const OFFER = 'GET /api/rider/v1/me/offer'
const DECLINE_1 = 'POST /api/rider/v1/me/offers/00000000-0000-4000-8000-000000000b01/decline'
const DECLINE_2 = 'POST /api/rider/v1/me/offers/00000000-0000-4000-8000-000000000b02/decline'

const none = { items: [], page: 1, pageSize: 24, total: 0 }

let geo: ReturnType<typeof fakeGeolocation>

beforeEach(() => {
  setToken('tok')
  vi.useFakeTimers({ shouldAdvanceTime: true })
  geo = fakeGeolocation()
})

afterEach(() => {
  geo.remove()
  clearToken()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// The signed-in home page for a rider who is online or offline; `calls` is every request the fake service received.
function routes(isOnline: boolean, over: Routes = {}) {
  return fakeApi({
    ...signedInRoutes(),
    'GET /api/rider/v1/me': () => json(200, { ...arjun, isOnline }),
    [READY]: () => json(200, { items: [] }),
    [DELIVERIES]: () => json(200, none),
    [LOCATION]: () => json(204),
    ...over,
  })
}

function offerReads(calls: Request[]) {
  return calls.filter((request) => request.method === 'GET' && new URL(request.url).pathname === '/api/rider/v1/me/offer').length
}

test('offline sends no offer read', async () => {
  const calls = routes(false)
  renderApp('/')

  expect(await screen.findByRole('heading', { name: 'Ready to pick up' })).toBeInTheDocument()
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(offerReads(calls)).toBe(0)
})

test('polled every 3 seconds', async () => {
  const calls = routes(true, { [OFFER]: () => json(204) })
  renderApp('/')

  await screen.findByRole('heading', { name: 'Ready to pick up' })
  await waitFor(() => expect(offerReads(calls)).toBe(1))
  await act(() => vi.advanceTimersByTimeAsync(3_000))
  expect(offerReads(calls)).toBe(2)
  await act(() => vi.advanceTimersByTimeAsync(3_000))
  expect(offerReads(calls)).toBe(3)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('offer shown', async () => {
  routes(true, { [OFFER]: () => json(200, offer()) })
  renderApp('/')

  const sheet = await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  expect(within(sheet).getByText('3 items')).toBeInTheDocument()
  expect(within(sheet).getByText('560034')).toBeInTheDocument()
  expect(within(sheet).getByText('₹339')).toBeInTheDocument()
  expect(within(sheet).getByText('Cash')).toBeInTheDocument()
  expect(within(sheet).getByText('30 s left')).toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: 'Accept' })).toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: 'Decline' })).toBeInTheDocument()
})

test('offer expires', async () => {
  const same = offer()
  routes(true, { [OFFER]: () => json(200, same) })
  renderApp('/')

  await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  await act(() => vi.advanceTimersByTimeAsync(30_000))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(await screen.findByRole('status')).toHaveTextContent('Offer expired')

  await act(() => vi.advanceTimersByTimeAsync(6_000))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('decline closes the sheet', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const o1 = offer()
  const o2 = offer({ id: '00000000-0000-4000-8000-000000000b02', number: 'SS-AAAA0002' })
  let current = o1
  const declined = { first: 0, second: 0 }
  routes(true, {
    [OFFER]: () => json(200, current),
    [DECLINE_1]: () => {
      declined.first += 1
      current = o2
      return json(204)
    },
    [DECLINE_2]: () => {
      declined.second += 1
      return json(204)
    },
  })
  renderApp('/')

  const first = await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  await user.click(within(first).getByRole('button', { name: 'Decline' }))
  expect(screen.queryByRole('dialog', { name: 'New order SS-AAAA0001' })).toBeNull()

  await act(() => vi.advanceTimersByTimeAsync(3_000))
  await screen.findByRole('dialog', { name: 'New order SS-AAAA0002' })

  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(declined).toEqual({ first: 1, second: 1 })

  await act(() => vi.advanceTimersByTimeAsync(6_000))
  expect(screen.queryByRole('dialog')).toBeNull()
})
