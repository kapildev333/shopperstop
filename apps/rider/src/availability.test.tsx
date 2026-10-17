import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { apiError, arjun, fakeApi, json, signedInRoutes } from './fake-api'
import { fakeGeolocation } from './fake-geolocation'
import { renderApp } from './render-app'

type Routes = Parameters<typeof fakeApi>[0]

const READY = 'GET /api/rider/v1/me/ready-orders'
const DELIVERIES = 'GET /api/rider/v1/me/deliveries'
const AVAILABILITY = 'PUT /api/rider/v1/me/availability'
const LOCATION = 'PUT /api/rider/v1/me/location'

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

// The signed-in home page; the availability bodies the service received are collected in `bodies`, the positions in `sent`.
function routes(over: Routes = {}) {
  const bodies: unknown[] = []
  const sent: unknown[] = []
  const calls = fakeApi({
    ...signedInRoutes(),
    [READY]: () => json(200, { items: [] }),
    [DELIVERIES]: () => json(200, none),
    [AVAILABILITY]: async (request) => {
      const body = (await request.json()) as { online: boolean }
      bodies.push(body)
      return json(200, { ...arjun, isOnline: body.online })
    },
    [LOCATION]: async (request) => {
      sent.push(await request.json())
      return json(204)
    },
    ...over,
  })
  return { calls, bodies, sent }
}

const online = { 'GET /api/rider/v1/me': () => json(200, { ...arjun, isOnline: true }) }
const fix = { lat: 12.9719, lng: 77.6412 }

test('offline rider', async () => {
  routes()
  renderApp('/')

  const banner = await screen.findByRole('banner')
  expect(await within(banner).findByText('Offline')).toBeInTheDocument()
  expect(within(banner).getByRole('button', { name: 'Go online' })).not.toHaveAttribute('aria-pressed')
})

test('go online, then offline', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { bodies } = routes()
  renderApp('/')

  const banner = await screen.findByRole('banner')
  await user.click(await within(banner).findByRole('button', { name: 'Go online' }))
  expect(await within(banner).findByRole('button', { name: 'Go offline' })).not.toHaveAttribute('aria-pressed')
  expect(within(banner).getByText('Online')).toBeInTheDocument()

  await user.click(within(banner).getByRole('button', { name: 'Go offline' }))
  expect(await within(banner).findByRole('button', { name: 'Go online' })).not.toHaveAttribute('aria-pressed')
  expect(within(banner).getByText('Offline')).toBeInTheDocument()
  expect(bodies).toEqual([{ online: true }, { online: false }])
})

test('change fails', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  routes({ [AVAILABILITY]: () => apiError(502, 'internal') })
  renderApp('/')

  const banner = await screen.findByRole('banner')
  await user.click(await within(banner).findByRole('button', { name: 'Go online' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Could not change your status. Try again.')
  expect(within(banner).getByText('Offline')).toBeInTheDocument()
})

test('toggle disabled while pending', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  let release!: (r: Response) => void
  routes({ [AVAILABILITY]: () => new Promise<Response>((r) => { release = r }) })
  renderApp('/')

  const banner = await screen.findByRole('banner')
  await user.click(await within(banner).findByRole('button', { name: 'Go online' }))
  expect(within(banner).getByRole('button', { name: 'Go online' })).toBeDisabled()

  act(() => release(json(200, { ...arjun, isOnline: true })))
  expect(await within(banner).findByRole('button', { name: 'Go offline' })).toBeEnabled()
})

test('failure message cleared by a later success', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  let answers = 0
  routes({
    ...online,
    [AVAILABILITY]: async (request) => {
      answers += 1
      if (answers === 1) return apiError(502, 'internal')
      const body = (await request.json()) as { online: boolean }
      return json(200, { ...arjun, isOnline: body.online })
    },
  })
  renderApp('/')

  const banner = await screen.findByRole('banner')
  await user.click(await within(banner).findByRole('button', { name: 'Go offline' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Could not change your status. Try again.')
  expect(within(banner).getByText('Online')).toBeInTheDocument()

  await waitFor(() => expect(geo.watching()).toBe(1))
  act(() => geo.fail(1))

  expect(await within(banner).findByText('Offline')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Allow location to go online')
  expect(screen.queryByText('Could not change your status. Try again.')).toBeNull()
})

test('first fix, then every 10 seconds', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { sent } = routes()
  renderApp('/')

  const banner = await screen.findByRole('banner')
  await user.click(await within(banner).findByRole('button', { name: 'Go online' }))
  await waitFor(() => expect(geo.watching()).toBe(1))
  act(() => geo.fix(fix.lat, fix.lng))
  await waitFor(() => expect(sent).toEqual([fix]))

  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(sent).toEqual([fix, fix])
})

test('online on load', async () => {
  routes({ ...online, [DELIVERIES]: () => json(200, none) })
  renderApp('/history')

  expect(await screen.findByRole('heading', { level: 1, name: 'History' })).toBeInTheDocument()
  await waitFor(() => expect(geo.watching()).toBe(1))
})

test('online watch options', async () => {
  routes({ ...online, [DELIVERIES]: () => json(200, none) })
  renderApp('/history')

  await screen.findByRole('heading', { level: 1, name: 'History' })
  await waitFor(() => expect(geo.watching()).toBe(1))
  expect(geo.options()).toEqual([{ enableHighAccuracy: false, maximumAge: 10_000 }])
})

test('offline stops the watch', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { sent } = routes(online)
  renderApp('/')

  const banner = await screen.findByRole('banner')
  await waitFor(() => expect(geo.watching()).toBe(1))
  act(() => geo.fix(fix.lat, fix.lng))
  await waitFor(() => expect(sent).toEqual([fix]))

  await user.click(await within(banner).findByRole('button', { name: 'Go offline' }))
  await waitFor(() => expect(geo.watching()).toBe(0))
  await act(() => vi.advanceTimersByTimeAsync(20_000))
  expect(sent).toEqual([fix])
})

test('sign-out stops the watch', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { sent } = routes({
    ...online,
    'POST /api/rider/v1/auth/sign-out': () => new Response(null, { status: 204 }),
  })
  renderApp('/')

  await screen.findByRole('banner')
  await waitFor(() => expect(geo.watching()).toBe(1))
  act(() => geo.fix(fix.lat, fix.lng))
  await waitFor(() => expect(sent).toEqual([fix]))

  await user.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
  await waitFor(() => expect(geo.watching()).toBe(0))
  await act(() => vi.advanceTimersByTimeAsync(20_000))
  expect(sent).toEqual([fix])
})

test('permission refused', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { bodies } = routes()
  renderApp('/')

  const banner = await screen.findByRole('banner')
  await user.click(await within(banner).findByRole('button', { name: 'Go online' }))
  await waitFor(() => expect(geo.watching()).toBe(1))
  act(() => geo.fail(1))

  await waitFor(() => expect(bodies).toEqual([{ online: true }, { online: false }]))
  expect(within(banner).getByText('Offline')).toBeInTheDocument()
  expect(await screen.findByRole('status')).toHaveTextContent('Allow location to go online')
})

test('no geolocation api', async () => {
  const { bodies } = routes(online)
  geo.remove()
  renderApp('/')

  await screen.findByRole('banner')
  await waitFor(() => expect(bodies).toEqual([{ online: false }]))
  expect(await screen.findByRole('status')).toHaveTextContent('Allow location to go online')
})
