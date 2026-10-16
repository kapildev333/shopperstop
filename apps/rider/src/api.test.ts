import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { core, onUnauthorized, rider } from './api'
import { clearToken, getToken, setToken } from './session'
import { apiError, arjun, fakeApi, json, koramangala } from './fake-api'
import { renderApp } from './render-app'

const storePath = `/api/core/v1/stores/${koramangala.id}`

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

test("clients call the page's origin", async () => {
  setToken('tok')
  const calls = fakeApi({ 'GET /api/rider/v1/me': () => json(200, arjun), [`GET ${storePath}`]: () => json(200, koramangala) })

  await rider.GET('/me')
  await core.GET('/stores/{id}', { params: { path: { id: koramangala.id } } })

  expect(calls[0].url).toBe(`${location.origin}/api/rider/v1/me`)
  expect(calls[1].url).toBe(`${location.origin}${storePath}`)
})

test('core never gets the rider token', async () => {
  setToken('tok')
  const calls = fakeApi({ [`GET ${storePath}`]: () => json(200, koramangala) })

  await core.GET('/stores/{id}', { params: { path: { id: koramangala.id } } })

  expect(calls[0].headers.has('Authorization')).toBe(false)
})

test('a 401 to a replaced token keeps the new session', async () => {
  setToken('old')
  const lost = vi.fn()
  onUnauthorized(lost)
  fakeApi({
    'GET /api/rider/v1/me': () => {
      setToken('new')
      return apiError(401, 'unauthorized')
    },
  })

  await rider.GET('/me')

  expect(getToken()).toBe('new')
  expect(localStorage.getItem('shopperstop:rider-token')).toBe('new')
  expect(lost).not.toHaveBeenCalled()
})

test.each([
  ['no body', () => new Response(null, { status: 502 })],
  ['a plain-text body', () => new Response('Bad Gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } })],
])('a failure answer with %s reaches the caller as an internal error with its status', async (_, answer) => {
  setToken('tok')
  fakeApi({ 'GET /api/rider/v1/me': answer })

  const { data, error, response } = await rider.GET('/me')

  expect(data).toBeUndefined()
  expect(error).toEqual({ error: { code: 'internal', message: 'The server did not answer as expected.' } })
  expect(response.status).toBe(502)
  expect(getToken()).toBe('tok')
})

test('expired session on load returns to sign-in', async () => {
  setToken('tok')
  fakeApi({ 'GET /api/rider/v1/me': () => apiError(401, 'unauthorized') })

  const router = renderApp('/history')

  await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
  expect(router.state.location.search).toEqual({ redirect: '/history' })
  expect(getToken()).toBeNull()
  expect(localStorage.getItem('shopperstop:rider-token')).toBeNull()
})

test('service unreachable on load shows a retry and keeps the session', async () => {
  setToken('tok')
  fakeApi({ 'GET /api/rider/v1/me': () => apiError(502, 'internal') })

  renderApp('/')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not reach the server.')
  expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  expect(screen.getByRole('banner')).toBeInTheDocument()
  expect(getToken()).toBe('tok')
})
