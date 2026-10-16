import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, getToken, setToken } from './session'
import { admin, apiError, fakeCore, json, storeStaff } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

test('dashboard renders in the shell', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => json(200, admin) })

  renderApp('/')

  expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  const banner = screen.getByRole('banner')
  expect(banner).toHaveTextContent('ShopperStop Admin')
  expect(within(banner).getByText(admin.name)).toBeInTheDocument()
  expect(within(banner).getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  const nav = screen.getByRole('navigation', { name: 'Admin' })
  expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
})

test('unknown path', async () => {
  const calls = fakeCore({})

  renderApp('/nope')

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(screen.getByRole('banner')).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Admin' })).not.toBeInTheDocument()
  expect(calls).toHaveLength(0)
})

test('admin sees every section', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => json(200, admin) })

  renderApp('/')

  const nav = await screen.findByRole('navigation', { name: 'Admin' })
  const links = within(nav).getAllByRole('link').map((link) => link.textContent)
  expect(links).toEqual(['Dashboard', 'Orders', 'Stock', 'Riders', 'Stores', 'Categories', 'Products', 'Staff'])
})

test('store staff see dashboard, orders and stock', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => json(200, storeStaff) })

  renderApp('/')

  const nav = await screen.findByRole('navigation', { name: 'Admin' })
  const links = within(nav).getAllByRole('link').map((link) => link.textContent)
  expect(links).toEqual(['Dashboard', 'Orders', 'Stock', 'Riders'])
})

test('signed-out deep link goes to sign-in with the path', async () => {
  const calls = fakeCore({})

  const router = renderApp('/stock')

  await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
  expect(router.state.location.search).toEqual({ redirect: '/stock' })
  expect(calls).toHaveLength(0)
})

test('store staff deep link to an admin page shows not found in the shell', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => json(200, storeStaff) })

  const router = renderApp('/stores')

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Admin' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/stores')
})

test('admin opens an admin page', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => json(200, admin) })

  renderApp('/stores')

  expect(await screen.findByRole('heading', { level: 1, name: 'Stores' })).toBeInTheDocument()
  const nav = screen.getByRole('navigation', { name: 'Admin' })
  expect(within(nav).getByRole('link', { name: 'Stores' })).toHaveAttribute('aria-current', 'page')
  expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
})

test('a 403 from core shows not found, not sign-in', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => apiError(403, 'forbidden') })

  const router = renderApp('/stock')

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(screen.getByRole('banner')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/stock')
  expect(getToken()).toBe('tok')
})

test('expired session on load returns to sign-in', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => apiError(401, 'unauthorized') })

  const router = renderApp('/orders')

  await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
  expect(router.state.location.search).toEqual({ redirect: '/orders' })
  expect(getToken()).toBeNull()
  expect(localStorage.getItem('shopperstop:staff-token')).toBeNull()
})

test('core unreachable on load shows a retry', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => apiError(500, 'internal') })

  renderApp('/')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not reach the server.')
  expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  expect(screen.getByRole('banner')).toBeInTheDocument()
  expect(getToken()).toBe('tok')
})

test('sign out ends the session', async () => {
  setToken('tok')
  const calls = fakeCore({
    'GET /admin/me': () => json(200, admin),
    'POST /admin/auth/sign-out': () => new Response(null, { status: 204 }),
  })

  const router = renderApp('/')
  await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/sign-in')
  const signOut = calls.find((call) => call.url.endsWith('/admin/auth/sign-out'))
  expect(signOut?.method).toBe('POST')
  expect(signOut?.headers.get('Authorization')).toBe('Bearer tok')
  expect(getToken()).toBeNull()
  expect(localStorage.getItem('shopperstop:staff-token')).toBeNull()
  expect(screen.queryByRole('navigation', { name: 'Admin' })).not.toBeInTheDocument()
  expect(router.options.context.queryClient.getQueryCache().getAll()).toEqual([])
})
