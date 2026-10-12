import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, indiranagar, json, koramangala, storeList } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

test('stores table lists every store', async () => {
  setToken('tok')
  const calls = fakeCore({ 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([indiranagar, koramangala]) })

  renderApp('/stores')

  const table = await screen.findByRole('table', { name: 'Stores' })
  const rows = within(table).getAllByRole('row').slice(1)
  expect(within(table).getAllByRole('link').map((link) => link.textContent)).toEqual(['Indiranagar', 'Koramangala'])
  expect(within(rows[1]).getByRole('link', { name: 'Koramangala' })).toHaveAttribute('href', `/stores/${koramangala.id}`)
  expect(rows[1]).toHaveTextContent('560034')
  expect(within(rows[1]).getByText('Open')).toBeInTheDocument()
  expect(within(rows[0]).getByText('Closed')).toBeInTheDocument()
  expect(rows[1]).toHaveTextContent('₹25')
  expect(rows[1]).toHaveTextContent('₹199')
  expect(rows[1]).toHaveTextContent('₹99')
  expect(rows[1]).toHaveTextContent('10 min')
  expect(screen.getByRole('link', { name: 'New store' })).toHaveAttribute('href', '/stores/new')
  expect(new URL(calls.find((call) => call.url.includes('/admin/stores'))!.url).searchParams.get('pageSize')).toBe('100')
})

test('no stores shows the empty state', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([]) })

  renderApp('/stores')

  expect(await screen.findByRole('heading', { level: 2, name: 'No stores yet' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'New store' })).toBeInTheDocument()
})

test('stores table shows a skeleton while loading', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => new Promise<Response>(() => {}) })

  renderApp('/stores')

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Stores' })).toBeInTheDocument()
})

test('stores load failure shows a retry that reloads', async () => {
  setToken('tok')
  let fail = true
  fakeCore({
    'GET /admin/me': () => json(200, admin),
    'GET /admin/stores': () => (fail ? apiError(500, 'internal') : storeList([koramangala])),
  })

  renderApp('/stores')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not load the stores.')
  fail = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('link', { name: 'Koramangala' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
