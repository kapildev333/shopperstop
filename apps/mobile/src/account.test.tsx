import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import Account from './app/account'
import { queryClient } from './api'
import { apiError, fakeCore, json } from './fake-core'
import { setToken } from './session'

const customer = { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.com', name: 'Asha Rao', phone: '9876543210' }
const home = { id: '3f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f71', label: 'Home', line1: '5 Lake Rd', pincode: '560001', isDefault: true }
const work = { id: '3f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f72', label: 'Work', line1: '1 Park St', line2: 'Floor 2', pincode: '560038', isDefault: false }

// The root layout provides the query client in the app; the screen needs it here too.
function renderAccount() {
  return render(
    <QueryClientProvider client={queryClient}>
      <Account />
    </QueryClientProvider>,
  )
}

// Non-navigating tests: the screen renders under no router, so each test owns one render.

test('Profile shown', async () => {
  setToken('t-acct')
  fakeCore({
    'GET /me': () => json(200, customer),
    'GET /me/addresses': () => json(200, { items: [] }),
  })
  await renderAccount()

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
  await renderAccount()

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
  await renderAccount()

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
  await renderAccount()

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
  await renderAccount()

  expect(await screen.findByText('No saved addresses. Add one to check out faster.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Add address' })).toBeTruthy()
})

test('Loading account', async () => {
  setToken('t-acct')
  fakeCore({
    'GET /me': () => new Promise<Response>(() => undefined),
    'GET /me/addresses': () => new Promise<Response>(() => undefined),
  })
  await renderAccount()

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
  await renderAccount()

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
  await renderAccount()

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
  await renderAccount()

  await waitFor(() => expect(queryClient.getQueryState(['me', 't-acct'])?.status).toBe('error'))
  await waitFor(() => expect(queryClient.getQueryState(['addresses', 't-acct'])?.status).toBe('error'))
  expect(screen.getByText('Asha Rao')).toBeTruthy()
  expect(screen.getByText('Home')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

// A row action holds its request open; a second press while it is pending must not send another one.
function holdUntil() {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  return { gate, release }
}

test('set default is not sent twice while pending', async () => {
  setToken('t-acct')
  const hold = holdUntil()
  const calls = fakeCore({
    'GET /me': () => json(200, customer),
    'GET /me/addresses': () => json(200, { items: [home, work] }),
    [`PATCH /me/addresses/${work.id}`]: async () => {
      await hold.gate
      return json(200, { ...work, isDefault: true })
    },
  })
  await renderAccount()

  await fireEvent.press(await screen.findByRole('button', { name: 'Set Work as default' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Set Work as default' }))
  hold.release()

  await waitFor(() => expect(calls.filter((request) => request.method === 'PATCH')).toHaveLength(1))
})

test('delete is not sent twice while pending', async () => {
  setToken('t-acct')
  const hold = holdUntil()
  const calls = fakeCore({
    'GET /me': () => json(200, customer),
    'GET /me/addresses': () => json(200, { items: [home, work] }),
    [`DELETE /me/addresses/${work.id}`]: async () => {
      await hold.gate
      return json(204)
    },
  })
  await renderAccount()

  await fireEvent.press(await screen.findByRole('button', { name: 'Delete Work' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Delete Work' }))
  hold.release()

  await waitFor(() => expect(calls.filter((request) => request.method === 'DELETE')).toHaveLength(1))
})

// Both presses land before React renders the disabled state, so only the in-flight ref can stop the second one.
test('set default is not sent twice when pressed twice in one tick', async () => {
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
  await renderAccount()

  const button = await screen.findByRole('button', { name: 'Set Work as default' })
  await act(async () => {
    void fireEvent.press(button)
    void fireEvent.press(button)
  })

  await waitFor(() => expect(calls.filter((request) => request.method === 'PATCH')).toHaveLength(1))
  // Wait for the refetch the write triggers, so the test does not end with a request in flight.
  expect(await screen.findByRole('button', { name: 'Set Home as default' })).toBeTruthy()
})

test('a row request that rejects leaves the row buttons enabled', async () => {
  setToken('t-acct')
  fakeCore({
    'GET /me': () => json(200, customer),
    'GET /me/addresses': () => json(200, { items: [home, work] }),
    [`PATCH /me/addresses/${work.id}`]: () => {
      throw new TypeError('Network request failed')
    },
  })
  await renderAccount()

  await fireEvent.press(await screen.findByRole('button', { name: 'Set Work as default' }))

  expect(await screen.findByText('Could not reach ShopperStop. Try again.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Set Work as default' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Delete Work' })).toBeEnabled()
})
