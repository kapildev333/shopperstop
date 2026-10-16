import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import Account from './app/account'
import { queryClient } from './api'
import { apiError, fakeCore, json } from './fake-core'
import { setToken } from './session'

const customer = { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.com', name: 'Asha Rao', phone: '9876543210' }
const home = { id: '3f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f71', label: 'Home', line1: '5 Lake Rd', pincode: '560001', isDefault: true }
const work = { id: '3f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f72', label: 'Work', line1: '1 Park St', line2: 'Floor 2', pincode: '560038', isDefault: false }

// Non-navigating tests: the screen renders under no router, so each test owns one render.

test('Profile shown', async () => {
  setToken('t-acct')
  fakeCore({
    'GET /me': () => json(200, customer),
    'GET /me/addresses': () => json(200, { items: [] }),
  })
  await render(<Account />)

  expect(await screen.findByRole('heading', { name: 'My account' })).toBeTruthy()
  expect(screen.getByText('Asha Rao')).toBeTruthy()
  expect(screen.getByText('asha@example.com')).toBeTruthy()
  expect(screen.getByText('9876543210')).toBeTruthy()
})

test('Profile saved (card half)', async () => {
  setToken('t-acct')
  const calls = fakeCore({
    'GET /me': () => json(200, { id: customer.id, email: customer.email, name: customer.name }),
    'GET /me/addresses': () => json(200, { items: [] }),
    'PATCH /me': () => json(200, customer),
  })
  await render(<Account />)

  await fireEvent.press(await screen.findByRole('button', { name: 'Edit profile' }))
  await fireEvent.changeText(screen.getByLabelText('Phone'), '9876543210')
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('9876543210')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Edit profile' })).toBeNull()
  expect(calls.filter((request) => request.method === 'PATCH')).toHaveLength(1)
})

test('Addresses and default', async () => {
  setToken('t-acct')
  let defaultId = home.id
  const listed = () => [home, work].map((address) => ({ ...address, isDefault: address.id === defaultId }))
  const calls = fakeCore({
    'GET /me': () => json(200, customer),
    'GET /me/addresses': () => json(200, { items: listed() }),
    [`PATCH /me/addresses/${work.id}`]: () => {
      defaultId = work.id
      return json(200, { ...work, isDefault: true })
    },
  })
  await render(<Account />)

  await fireEvent.press(await screen.findByRole('button', { name: 'Set Work as default' }))

  expect(await screen.findByRole('button', { name: 'Set Home as default' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Set Work as default' })).toBeNull()
  expect(screen.getAllByText('Default')).toHaveLength(1)
  const patch = calls.find((request) => request.method === 'PATCH')
  expect(patch && (await patch.json())).toEqual({ isDefault: true })
})

test('Address deleted', async () => {
  setToken('t-acct')
  let deleted = false
  const calls = fakeCore({
    'GET /me': () => json(200, customer),
    'GET /me/addresses': () => json(200, { items: deleted ? [home] : [home, work] }),
    [`DELETE /me/addresses/${work.id}`]: () => {
      deleted = true
      return json(204)
    },
  })
  await render(<Account />)

  await fireEvent.press(await screen.findByRole('button', { name: 'Delete Work' }))

  await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete Work' })).toBeNull())
  expect(screen.getByRole('button', { name: 'Delete Home' })).toBeTruthy()
  expect(calls.some((request) => request.method === 'DELETE' && new URL(request.url).pathname.endsWith(`/me/addresses/${work.id}`))).toBe(true)
})

test('No addresses', async () => {
  setToken('t-acct')
  fakeCore({
    'GET /me': () => json(200, customer),
    'GET /me/addresses': () => json(200, { items: [] }),
  })
  await render(<Account />)

  expect(await screen.findByText('No saved addresses. Add one to check out faster.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Add address' })).toBeTruthy()
})

test('Loading account', async () => {
  setToken('t-acct')
  fakeCore({
    'GET /me': () => new Promise<Response>(() => undefined),
    'GET /me/addresses': () => new Promise<Response>(() => undefined),
  })
  await render(<Account />)

  expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0)
  expect(screen.queryByText('Asha Rao')).toBeNull()
})

test('Core unreachable with nothing held', async () => {
  setToken('t-acct')
  let reachable = false
  fakeCore({
    'GET /me': () => {
      if (!reachable) throw new TypeError('Network request failed')
      return json(200, customer)
    },
    'GET /me/addresses': () => json(200, { items: [] }),
  })
  await render(<Account />)

  expect(await screen.findByText("You're offline")).toBeTruthy()
  expect(screen.getByText('Check your connection and try again.')).toBeTruthy()
  reachable = true
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('Asha Rao')).toBeTruthy()
})

test('Core failure with nothing held', async () => {
  setToken('t-acct')
  fakeCore({
    'GET /me': () => json(200, customer),
    'GET /me/addresses': () => apiError(500, 'internal', 'Database is down'),
  })
  await render(<Account />)

  expect(await screen.findByText('Something went wrong on our side')).toBeTruthy()
  expect(screen.getByText('Please try again in a moment.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
})

test('Failed refetch keeps the account', async () => {
  setToken('t-acct')
  // Both reads were answered more than 60 seconds ago; no fake is installed, so every refetch is refused.
  const stale = Date.now() - 61_000
  queryClient.setQueryData(['me', 't-acct'], customer, { updatedAt: stale })
  queryClient.setQueryData(['addresses', 't-acct'], [home, work], { updatedAt: stale })
  await render(<Account />)

  await waitFor(() => expect(queryClient.getQueryState(['me', 't-acct'])?.status).toBe('error'))
  await waitFor(() => expect(queryClient.getQueryState(['addresses', 't-acct'])?.status).toBe('error'))
  expect(screen.getByText('Asha Rao')).toBeTruthy()
  expect(screen.getByText('Home')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})
