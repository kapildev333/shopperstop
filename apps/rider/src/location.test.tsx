import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { apiError, delivery, fakeApi, json, signedInRoutes } from './fake-api'
import { fakeGeolocation } from './fake-geolocation'
import { renderApp } from './render-app'

const id = delivery().id
const deliveryPath = `/api/rider/v1/me/deliveries/${id}`
const markPath = `${deliveryPath}/delivered`
const locationPath = '/api/rider/v1/me/location'
const off = 'Location is off. The customer cannot see where you are.'
const fix = { lat: 12.9352, lng: 77.6245 }

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

// The delivery page of an assigned delivery; the positions the service received are collected in `sent`.
function openAssigned(over: Parameters<typeof fakeApi>[0] = {}) {
  const sent: unknown[] = []
  const calls = fakeApi({
    ...signedInRoutes(),
    [`GET ${deliveryPath}`]: () => json(200, delivery()),
    [`PUT ${locationPath}`]: async (request) => {
      sent.push(await request.json())
      return json(204)
    },
    ...over,
  })
  renderApp(`/deliveries/${id}`)
  return { calls, sent }
}

async function ready() {
  expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-AAAA0001' })).toBeInTheDocument()
  await waitFor(() => expect(geo.watching()).toBe(1))
}

test('first fix sent, then every 15 seconds', async () => {
  const { sent } = openAssigned()
  await ready()

  act(() => geo.fix(fix.lat, fix.lng))
  await waitFor(() => expect(sent).toEqual([{ lat: fix.lat, lng: fix.lng }]))

  await act(() => vi.advanceTimersByTimeAsync(15_000))
  expect(sent).toEqual([{ lat: fix.lat, lng: fix.lng }, { lat: fix.lat, lng: fix.lng }])
})

test('a late first fix starts the count', async () => {
  const { sent } = openAssigned()
  await ready()

  await act(() => vi.advanceTimersByTimeAsync(14_000))
  act(() => geo.fix(fix.lat, fix.lng))
  await waitFor(() => expect(sent).toHaveLength(1))

  await act(() => vi.advanceTimersByTimeAsync(1_000))
  expect(sent).toHaveLength(1)

  await act(() => vi.advanceTimersByTimeAsync(14_000))
  expect(sent).toHaveLength(2)
})

test('stops after delivered', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { sent } = openAssigned({
    [`POST ${markPath}`]: () => json(200, delivery({ status: 'delivered', deliveredAt: new Date().toISOString() })),
  })
  await ready()
  act(() => geo.fix(fix.lat, fix.lng))
  await act(() => vi.advanceTimersByTimeAsync(15_000))
  expect(sent).toHaveLength(2)

  await user.click(screen.getByRole('button', { name: 'Mark delivered' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark delivered' }))
  expect(await screen.findByText('SS-AAAA0001 delivered.')).toBeInTheDocument()
  expect(geo.watching()).toBe(0)

  await act(() => vi.advanceTimersByTimeAsync(30_000))
  expect(sent).toHaveLength(2)
})

test('a delivered delivery is never watched', async () => {
  const sent: unknown[] = []
  fakeApi({
    ...signedInRoutes(),
    [`GET ${deliveryPath}`]: () => json(200, delivery({ status: 'delivered', deliveredAt: new Date().toISOString() })),
    [`PUT ${locationPath}`]: async (request) => {
      sent.push(await request.json())
      return json(204)
    },
  })
  renderApp(`/deliveries/${id}`)

  expect(await screen.findByText('Delivered')).toBeInTheDocument()
  expect(geo.watching()).toBe(0)
  act(() => geo.fix(fix.lat, fix.lng))
  expect(sent).toEqual([])
})

test('permission denied shows the message once and Mark delivered still works', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  openAssigned()
  await ready()

  act(() => geo.fail(1))
  act(() => geo.fail(1))

  expect(await screen.findByText(off)).toHaveAttribute('role', 'status')
  expect(screen.getAllByText(off)).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Mark delivered' }))
  expect(screen.getByRole('dialog', { name: 'Mark SS-AAAA0001 delivered?' })).toBeInTheDocument()
})

test('no geolocation api shows the message and the page works', async () => {
  geo.remove()
  openAssigned()

  expect(await screen.findByText(off)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mark delivered' })).toBeInTheDocument()
})

test('a failed send shows nothing and the next position is sent as scheduled', async () => {
  let fail = true
  const { sent, calls } = openAssigned({
    [`PUT ${locationPath}`]: async (request) => {
      if (fail) return apiError(502, 'internal')
      sent.push(await request.json())
      return json(204)
    },
  })
  await ready()

  act(() => geo.fix(fix.lat, fix.lng))
  await waitFor(() => expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(1))
  expect(screen.queryByText(off)).not.toBeInTheDocument()

  fail = false
  await act(() => vi.advanceTimersByTimeAsync(15_000))
  expect(sent).toEqual([{ lat: fix.lat, lng: fix.lng }])
  expect(screen.getByRole('button', { name: 'Mark delivered' })).toBeInTheDocument()
})
