import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, getToken, setToken } from './session'
import { apiError, arjun, fakeApi, koramangala, signedInRoutes } from './fake-api'
import { renderApp } from './render-app'

const storePath = `/api/core/v1/stores/${koramangala.id}`

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

test('pick up page in the shell', async () => {
  setToken('tok')
  fakeApi(signedInRoutes())

  renderApp('/')

  expect(await screen.findByRole('heading', { level: 1, name: 'Ready to pick up' })).toBeInTheDocument()
  const banner = screen.getByRole('banner')
  expect(banner).toHaveTextContent('ShopperStop Rider')
  expect(within(banner).getByText(arjun.name)).toBeInTheDocument()
  expect(within(banner).getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  const nav = screen.getByRole('navigation', { name: 'Rider' })
  expect(within(nav).getByRole('link', { name: 'Pick up' })).toHaveAttribute('aria-current', 'page')
  expect(within(nav).getByRole('link', { name: 'History' })).not.toHaveAttribute('aria-current')
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
})

test('history marked on its page', async () => {
  setToken('tok')
  fakeApi(signedInRoutes())

  renderApp('/history')

  expect(await screen.findByRole('heading', { level: 1, name: 'History' })).toBeInTheDocument()
  const nav = screen.getByRole('navigation', { name: 'Rider' })
  expect(within(nav).getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page')
  expect(within(nav).getByRole('link', { name: 'Pick up' })).not.toHaveAttribute('aria-current')
})

test('store name shown', async () => {
  setToken('tok')
  const calls = fakeApi(signedInRoutes())

  renderApp('/')

  expect(await screen.findByRole('heading', { level: 1, name: 'Ready to pick up' })).toBeInTheDocument()
  expect(await within(screen.getByRole('banner')).findByText('Koramangala')).toBeInTheDocument()
  const store = calls.find((call) => call.url.endsWith(storePath))
  expect(store?.headers.has('Authorization')).toBe(false)
})

test('store read fails', async () => {
  setToken('tok')
  fakeApi({ ...signedInRoutes(), [`GET ${storePath}`]: () => apiError(500, 'internal') })

  renderApp('/')

  expect(await screen.findByRole('heading', { level: 1, name: 'Ready to pick up' })).toBeInTheDocument()
  const banner = screen.getByRole('banner')
  expect(within(banner).getByText(arjun.name)).toBeInTheDocument()
  expect(within(banner).queryByText('Koramangala')).not.toBeInTheDocument()
  expect(within(banner).getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
})

test('unknown path signed out', async () => {
  const calls = fakeApi({})

  renderApp('/nope')

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(screen.getByRole('banner')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to Pick up' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Rider' })).not.toBeInTheDocument()
  expect(calls).toHaveLength(0)
})

test('signed-out deep link', async () => {
  const calls = fakeApi({})
  const path = '/deliveries/00000000-0000-4000-8000-000000000901'

  const router = renderApp(path)

  await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
  expect(router.state.location.search).toEqual({ redirect: path })
  expect(calls).toHaveLength(0)
})

test('sign out ends the session', async () => {
  setToken('tok')
  const calls = fakeApi({
    ...signedInRoutes(),
    'POST /api/rider/v1/auth/sign-out': () => new Response(null, { status: 204 }),
  })

  const router = renderApp('/')
  await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/sign-in')
  const signOut = calls.find((call) => call.url.endsWith('/api/rider/v1/auth/sign-out'))
  expect(signOut?.method).toBe('POST')
  expect(signOut?.headers.get('Authorization')).toBe('Bearer tok')
  expect(getToken()).toBeUndefined()
  expect(localStorage.getItem('shopperstop:rider-token')).toBeNull()
  expect(screen.queryByRole('navigation', { name: 'Rider' })).not.toBeInTheDocument()
  expect(router.options.context.queryClient.getQueryCache().getAll()).toEqual([])
})
