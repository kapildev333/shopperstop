import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, indiranagar, json, koramangala, storeList, storeStaff } from './fake-core'
import { renderApp } from './render-app'
import { arjun, kabir, riderService } from './riders-fake'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const asAdmin = { 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([indiranagar, koramangala]) }
const asStoreStaff = {
  'GET /admin/me': () => json(200, storeStaff),
  [`GET /stores/${storeStaff.storeId}`]: () => json(200, { ...koramangala, id: storeStaff.storeId, name: 'Whitefield' }),
}
const riderLists = (calls: Request[]) =>
  calls.filter((call) => call.method === 'GET' && new URL(call.url).pathname === '/api/rider/v1/admin/riders').map((call) => Object.fromEntries(new URL(call.url).searchParams))

test('an admin sees every store\'s riders by email with phone, store and status', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...riderService().routes })

  renderApp('/riders')

  const table = await screen.findByRole('table', { name: 'Riders' })
  expect(screen.getByRole('heading', { level: 1, name: 'Riders' })).toBeInTheDocument()
  expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Name', 'Email', 'Phone', 'Store', 'Status', 'Actions'])
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(2)
  for (const text of ['Arjun Rao', 'arjun@example.test', '+919000000001', 'Koramangala', 'Active']) expect(within(rows[0]).getByText(text)).toBeInTheDocument()
  for (const text of ['Kabir Shah', 'kabir@example.test', 'None', 'Indiranagar', 'Inactive']) expect(within(rows[1]).getByText(text)).toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue('')
  expect(within(screen.getByLabelText('Store')).getAllByRole('option').map((option) => option.textContent)).toEqual(['All stores', 'Indiranagar', 'Koramangala'])
  expect(riderLists(calls)).toEqual([{ pageSize: '100' }])
  const list = calls.find((call) => new URL(call.url).pathname === '/api/rider/v1/admin/riders')!
  expect(list.url).toBe(`${location.origin}/api/rider/v1/admin/riders?pageSize=100`)
  expect(list.headers.get('Authorization')).toBe('Bearer tok')
})

test('choosing a store lists only its riders and puts it in the URL; a store in the URL that is not one lists every store', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...riderService().routes })

  const router = renderApp('/riders')
  await screen.findByRole('table', { name: 'Riders' })
  await userEvent.selectOptions(screen.getByLabelText('Store'), koramangala.id)

  await waitFor(() => expect(screen.queryByText('Kabir Shah')).not.toBeInTheDocument())
  expect(screen.getByText('Arjun Rao')).toBeInTheDocument()
  expect(router.state.location.search).toEqual({ store: koramangala.id })
  expect(riderLists(calls).at(-1)).toEqual({ pageSize: '100', store: koramangala.id })

  await userEvent.selectOptions(screen.getByLabelText('Store'), '')
  expect(await screen.findByText('Kabir Shah')).toBeInTheDocument()
  expect(router.state.location.search).toEqual({})

  await router.navigate({ to: '/riders', search: { store: 'nope' } })
  expect(await screen.findByText('Kabir Shah')).toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue('')
  expect(riderLists(calls).every((query) => query.store !== 'nope')).toBe(true)
})

test('store staff see their store\'s riders with no store selector, no store column and no stores request', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asStoreStaff, ...riderService([arjun]).routes })

  renderApp('/riders?store=' + indiranagar.id)

  const table = await screen.findByRole('table', { name: 'Riders' })
  expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Name', 'Email', 'Phone', 'Status', 'Actions'])
  expect(await screen.findByText('Whitefield')).toBeInTheDocument()
  expect(screen.getByText(/^Store:/)).toHaveTextContent('Store: Whitefield')
  expect(screen.queryByLabelText('Store')).not.toBeInTheDocument()
  expect(calls.some((call) => new URL(call.url).pathname.endsWith('/admin/stores'))).toBe(false)
  expect(riderLists(calls)).toEqual([{ pageSize: '100' }])
})

test('the riders table shows a skeleton while loading', async () => {
  setToken('tok')
  const service = riderService()
  let answer = () => {}
  const held = new Promise<void>((resolve) => (answer = resolve))
  const list = '/api/rider/v1/admin/riders'
  fakeCore({
    ...asAdmin,
    ...service.routes,
    [`GET ${list}`]: async (request) => {
      await held
      return service.routes[`GET ${list}`](request)
    },
  })

  renderApp('/riders')

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  answer()
  expect(await screen.findByRole('table', { name: 'Riders' })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument()
})

test.each(['GET /api/rider/v1/admin/riders', 'GET /admin/stores'])('a first load in which %s fails shows a retry that reloads', async (route) => {
  setToken('tok')
  const routes: Record<string, (request: Request) => Response | Promise<Response>> = { ...asAdmin, ...riderService().routes }
  let fail = true
  const real = routes[route]
  routes[route] = (request) => (fail ? apiError(502, 'internal') : real(request))
  fakeCore(routes)

  renderApp('/riders')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not load the riders.')
  fail = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('table', { name: 'Riders' })).toHaveTextContent('Arjun Rao')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a store with no riders shows the empty state', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...riderService([]).routes })

  renderApp('/riders')

  expect(await screen.findByText('No riders yet')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'New rider' })).toBeInTheDocument()
})

test('more riders than one page says how many are shown', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, 'GET /api/rider/v1/admin/riders': () => json(200, { items: [arjun, kabir], page: 1, pageSize: 100, total: 130 }) })

  renderApp('/riders')

  expect(await screen.findByText('Showing the first 100 of 130 riders, by email.')).toBeInTheDocument()
})
