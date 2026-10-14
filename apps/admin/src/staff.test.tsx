import { notifyManager } from '@tanstack/react-query'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, json, koramangala, storeStaff } from './fake-core'
import { renderApp } from './render-app'
import { indu, kiran, staffCore } from './staff-fake'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const paths = (calls: Request[]) => calls.map((call) => new URL(call.url).pathname.replace('/api/core/v1', ''))

test('the staff table lists every staff user by email with role, store and status', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  renderApp('/staff')

  const table = await screen.findByRole('table', { name: 'Staff users' })
  expect(screen.getByRole('heading', { level: 1, name: 'Staff' })).toBeInTheDocument()
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(3)
  for (const text of ['Asha Admin', 'admin@example.test', 'Admin', 'All stores', 'Active']) expect(within(rows[0]).getByText(text)).toBeInTheDocument()
  expect(within(rows[0]).getByText('You')).toBeInTheDocument()
  for (const text of ['Indu Nair', 'indiranagar@example.test', 'Store staff', 'Indiranagar', 'Inactive']) expect(within(rows[1]).getByText(text)).toBeInTheDocument()
  for (const text of ['Kiran Rao', 'koramangala@example.test', 'Store staff', 'Koramangala', 'Active']) expect(within(rows[2]).getByText(text)).toBeInTheDocument()
  expect(within(rows[1]).queryByText('You')).not.toBeInTheDocument()
  expect(within(rows[2]).queryByText('You')).not.toBeInTheDocument()
  expect(screen.queryByText(/Showing the first/)).not.toBeInTheDocument()
  const list = calls.find((call) => new URL(call.url).pathname.endsWith('/admin/staff-users'))!
  expect(Object.fromEntries(new URL(list.url).searchParams)).toEqual({ pageSize: '100' })
})

test('the staff table shows a skeleton while loading', async () => {
  setToken('tok')
  const core = staffCore()
  let answer = () => {}
  const held = new Promise<void>((resolve) => (answer = resolve))
  fakeCore({
    ...core.routes,
    'GET /admin/staff-users': async (request) => {
      await held
      return core.routes['GET /admin/staff-users'](request)
    },
  })

  renderApp('/staff')

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  answer()
  expect(await screen.findByRole('table', { name: 'Staff users' })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument()
})

test.each(['GET /admin/staff-users', 'GET /admin/stores'])('a first load in which %s fails shows a retry that reloads', async (route) => {
  setToken('tok')
  const core = staffCore()
  let fail = true
  fakeCore({ ...core.routes, [route]: (request) => (fail ? apiError(500, 'internal') : core.routes[route](request)) })

  renderApp('/staff')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not load the staff users.')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  fail = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('table', { name: 'Staff users' })).toHaveTextContent('Kiran Rao')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a failed refetch keeps the staff table, with the one notice from the root', async () => {
  setToken('tok')
  const core = staffCore()
  let down = false
  const read = (route: string) => (request: Request) => (down ? json(502) : core.routes[route](request))
  fakeCore({ ...core.routes, 'GET /admin/staff-users': read('GET /admin/staff-users'), 'GET /admin/stores': read('GET /admin/stores') })
  const router = renderApp('/staff')
  await screen.findByRole('table', { name: 'Staff users' })
  // Every read on screen is made again, as on a window focus; TanStack Query tells the page one turn after the answers,
  // and `schedule` queues behind that. Without it the assertions would run against the page as it was before.
  const refetch = () =>
    act(async () => {
      await router.options.context.queryClient.refetchQueries({ type: 'active' })
      await new Promise<void>((told) => notifyManager.schedule(told))
    })

  down = true
  await refetch()

  const table = screen.getByRole('table', { name: 'Staff users' })
  expect(table).toHaveTextContent('Kiran Rao')
  expect(table).toHaveTextContent('Koramangala')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  // The one notice is the root layout's (admin-keep-data-on-refetch-error); the page shows none of its own.
  expect(screen.getAllByText('Could not refresh. Showing what was loaded last.')).toHaveLength(1)
  expect(screen.getByText('Could not refresh. Showing what was loaded last.')).toHaveAttribute('role', 'status')
  down = false
  await refetch()
  expect(screen.getByRole('table', { name: 'Staff users' })).toHaveTextContent('Kiran Rao')
  expect(screen.queryByText('Could not refresh. Showing what was loaded last.')).not.toBeInTheDocument()
})

test('more staff users than one page says the list is cut', async () => {
  setToken('tok')
  fakeCore({ ...staffCore().routes, 'GET /admin/staff-users': () => json(200, { items: [admin, indu, kiran], page: 1, pageSize: 100, total: 101 }) })

  renderApp('/staff')

  await screen.findByRole('table', { name: 'Staff users' })
  expect(screen.getByText('Showing the first 100 of 101 staff users, by email.')).toHaveAttribute('role', 'status')
})

test('a staff user whose store is not among the stores read shows as an unknown store', async () => {
  setToken('tok')
  const elsewhere = { ...kiran, storeId: '00000000-0000-4000-8000-0000000004ff' }
  fakeCore(staffCore([admin, elsewhere]).routes)

  renderApp('/staff')

  const table = await screen.findByRole('table', { name: 'Staff users' })
  expect(within(within(table).getAllByRole('row')[2]).getByText('Unknown store')).toBeInTheDocument()
  expect(table).not.toHaveTextContent(koramangala.name)
})

test('store staff who open /staff see not found, and core is not asked for the staff users', async () => {
  setToken('tok')
  const calls = fakeCore({ 'GET /admin/me': () => json(200, storeStaff) })

  const router = renderApp('/staff')

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/staff')
  expect(paths(calls)).toEqual(['/admin/me'])
})
