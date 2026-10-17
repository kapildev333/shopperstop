import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { apiError, arjun, delivery, fakeApi, json, offer, signedInRoutes } from './fake-api'
import { fakeGeolocation } from './fake-geolocation'
import { renderApp } from './render-app'

type Routes = Parameters<typeof fakeApi>[0]

const READY = 'GET /api/rider/v1/me/ready-orders'
const DELIVERIES = 'GET /api/rider/v1/me/deliveries'
const LOCATION = 'PUT /api/rider/v1/me/location'
const OFFER = 'GET /api/rider/v1/me/offer'
const AVAILABILITY = 'PUT /api/rider/v1/me/availability'
const DECLINE_1 = 'POST /api/rider/v1/me/offers/00000000-0000-4000-8000-000000000b01/decline'
const DECLINE_2 = 'POST /api/rider/v1/me/offers/00000000-0000-4000-8000-000000000b02/decline'
const ACCEPT_1 = 'POST /api/rider/v1/me/offers/00000000-0000-4000-8000-000000000b01/accept'

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
    [AVAILABILITY]: async (request) => {
      const body = (await request.json()) as { online: boolean }
      return json(200, { ...arjun, isOnline: body.online })
    },
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

test('accepted', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const accepted = { count: 0 }
  routes(true, {
    [OFFER]: () => json(200, offer()),
    [ACCEPT_1]: () => {
      accepted.count += 1
      return json(201, delivery({ id: 'd1' }))
    },
    'GET /api/rider/v1/me/deliveries/d1': () => json(200, delivery({ id: 'd1' })),
  })
  const router = renderApp('/')

  const sheet = await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  await user.click(within(sheet).getByRole('button', { name: 'Accept' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-AAAA0001' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/deliveries/d1')
  expect(accepted.count).toBe(1)
})

test('someone else took it', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  routes(true, {
    [OFFER]: () => json(200, offer()),
    [ACCEPT_1]: () => apiError(409, 'conflict'),
  })
  renderApp('/')

  const sheet = await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  await user.click(within(sheet).getByRole('button', { name: 'Accept' }))

  expect(await screen.findByRole('status')).toHaveTextContent('Someone else took SS-AAAA0001.')
  expect(screen.queryByRole('dialog')).toBeNull()

  await act(() => vi.advanceTimersByTimeAsync(6_000))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('accept fails', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  routes(true, {
    [OFFER]: () => json(200, offer()),
    [ACCEPT_1]: () => apiError(502, 'internal'),
  })
  renderApp('/')

  const sheet = await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  await user.click(within(sheet).getByRole('button', { name: 'Accept' }))

  expect(await within(sheet).findByRole('alert')).toHaveTextContent('Could not accept the order. Try again.')
  expect(screen.getByRole('dialog', { name: 'New order SS-AAAA0001' })).toBeInTheDocument()
})

test('going online again shows no old offer', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  let read: () => Response | Promise<Response> = () => json(200, offer())
  routes(true, { [OFFER]: () => read() })
  renderApp('/')

  await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  await waitFor(() => expect(geo.watching()).toBe(1))
  act(() => geo.fail(1))
  expect(await screen.findByText('Offline')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).toBeNull()

  read = () => new Promise<Response>(() => {})
  await user.click(screen.getByRole('button', { name: 'Go online' }))
  expect(await screen.findByText('Online')).toBeInTheDocument()
  await act(() => vi.advanceTimersByTimeAsync(100))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('going offline clears the offer status', async () => {
  const same = offer()
  routes(true, { [OFFER]: () => json(200, same) })
  renderApp('/')

  await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  await act(() => vi.advanceTimersByTimeAsync(30_000))
  expect(await screen.findByRole('status')).toHaveTextContent('Offer expired')

  await waitFor(() => expect(geo.watching()).toBe(1))
  act(() => geo.fail(1))
  expect(await screen.findByText('Offline')).toBeInTheDocument()
  expect(screen.queryByText('Offer expired')).toBeNull()
})

test('a new offer clears the old status', async () => {
  const o1 = offer()
  let read: () => Response | Promise<Response> = () => json(200, o1)
  routes(true, { [OFFER]: () => read() })
  renderApp('/')

  await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  await act(() => vi.advanceTimersByTimeAsync(30_000))
  expect(await screen.findByRole('status')).toHaveTextContent('Offer expired')

  const o2 = offer({ id: '00000000-0000-4000-8000-000000000b02', number: 'SS-AAAA0002' })
  read = () => json(200, o2)
  await act(() => vi.advanceTimersByTimeAsync(3_000))
  await screen.findByRole('dialog', { name: 'New order SS-AAAA0002' })

  read = () => json(204)
  await act(() => vi.advanceTimersByTimeAsync(3_000))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByText('Offer expired')).toBeNull()
})

test('close icon declines once', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const declined = { count: 0 }
  routes(true, {
    [OFFER]: () => json(200, offer()),
    [DECLINE_1]: () => {
      declined.count += 1
      return json(204)
    },
  })
  renderApp('/')

  const sheet = await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  await user.click(within(sheet).getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  await waitFor(() => expect(declined.count).toBe(1))

  await act(() => vi.advanceTimersByTimeAsync(6_000))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(declined.count).toBe(1)
})

test('countdown outside any live region', async () => {
  routes(true, { [OFFER]: () => json(200, offer()) })
  renderApp('/')

  const sheet = await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  expect(
    within(sheet).getByText('30 s left').closest('[aria-live], [role="status"], [role="alert"], [role="log"], [role="timer"]'),
  ).toBeNull()
})

test('no decline after expiry', async () => {
  const same = offer()
  const declined = { count: 0 }
  routes(true, {
    [OFFER]: () => json(200, same),
    [DECLINE_1]: () => {
      declined.count += 1
      return json(204)
    },
  })
  renderApp('/')

  await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  await act(() => vi.advanceTimersByTimeAsync(36_000))
  expect(await screen.findByRole('status')).toHaveTextContent('Offer expired')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(declined.count).toBe(0)
})

test('nothing answers while an accept is pending', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const declined = { count: 0 }
  // One fixed offer: a fresh one per poll would push its expiry back and the countdown would never run out.
  const same = offer()
  routes(true, {
    [OFFER]: () => json(200, same),
    [ACCEPT_1]: () => new Promise<Response>(() => {}),
    [DECLINE_1]: () => {
      declined.count += 1
      return json(204)
    },
  })
  renderApp('/')

  const sheet = await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  await user.click(within(sheet).getByRole('button', { name: 'Accept' }))
  const decline = within(sheet).getByRole('button', { name: 'Decline' })
  expect(decline).toBeDisabled()
  await user.click(decline)
  await user.keyboard('{Escape}')
  await act(() => vi.advanceTimersByTimeAsync(30_000))

  expect(screen.getByRole('dialog', { name: 'New order SS-AAAA0001' })).toBeInTheDocument()
  expect(declined.count).toBe(0)
  expect(screen.queryByText('Offer expired')).toBeNull()
})

test('someone else took it (404)', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  routes(true, {
    [OFFER]: () => json(200, offer()),
    [ACCEPT_1]: () => apiError(404, 'not_found'),
  })
  renderApp('/')

  const sheet = await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  await user.click(within(sheet).getByRole('button', { name: 'Accept' }))

  expect(await screen.findByRole('status')).toHaveTextContent('Someone else took SS-AAAA0001.')
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('accept invalidates the ready and assigned lists', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  routes(true, {
    [OFFER]: () => json(200, offer()),
    [ACCEPT_1]: () => json(201, delivery({ id: 'd1' })),
    'GET /api/rider/v1/me/deliveries/d1': () => json(200, delivery({ id: 'd1' })),
  })
  const router = renderApp('/')

  // The refetch of the mounted ready list clears its flag, so the calls are spied rather than the cache state read.
  const qc = router.options.context.queryClient
  const invalidate = vi.spyOn(qc, 'invalidateQueries')

  const sheet = await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  await user.click(within(sheet).getByRole('button', { name: 'Accept' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-AAAA0001' })).toBeInTheDocument()

  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['rider', 'ready'] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['rider', 'deliveries', 'assigned'] })
})

test('a new offer shows no old accept error', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const o1 = offer()
  const o2 = offer({ id: '00000000-0000-4000-8000-000000000b02', number: 'SS-AAAA0002' })
  let current = o1
  routes(true, {
    [OFFER]: () => json(200, current),
    [ACCEPT_1]: () => apiError(502, 'internal'),
    [DECLINE_1]: () => {
      current = o2
      return json(204)
    },
  })
  renderApp('/')

  const first = await screen.findByRole('dialog', { name: 'New order SS-AAAA0001' })
  await user.click(within(first).getByRole('button', { name: 'Accept' }))
  expect(await within(first).findByRole('alert')).toHaveTextContent('Could not accept the order. Try again.')

  await user.click(within(first).getByRole('button', { name: 'Decline' }))
  await act(() => vi.advanceTimersByTimeAsync(3_000))
  const second = await screen.findByRole('dialog', { name: 'New order SS-AAAA0002' })
  expect(within(second).queryByRole('alert')).toBeNull()
})
