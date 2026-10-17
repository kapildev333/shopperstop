import { screen, within } from '@testing-library/react'
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

// The signed-in home page; the availability bodies the service received are collected in `bodies`.
function routes(over: Routes = {}) {
  const bodies: unknown[] = []
  const calls = fakeApi({
    ...signedInRoutes(),
    [READY]: () => json(200, { items: [] }),
    [DELIVERIES]: () => json(200, none),
    [AVAILABILITY]: async (request) => {
      const body = (await request.json()) as { online: boolean }
      bodies.push(body)
      return json(200, { ...arjun, isOnline: body.online })
    },
    [LOCATION]: () => json(204),
    ...over,
  })
  return { calls, bodies }
}

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
