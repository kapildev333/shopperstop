import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import Account from './app/account'
import Home from './app/(tabs)/index'
import { fakeCore, json } from './fake-core'
import { getToken, setToken } from './session'

const customer = { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.com', name: 'Asha Rao' }

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('Sign out', async () => {
  setToken('t-acct')
  const calls = fakeCore({
    'GET /me': () => json(200, customer),
    'GET /me/addresses': () => json(200, { items: [] }),
    'POST /auth/sign-out': () => json(204),
  })
  const router = await renderRouter({ index: Home, account: Account }, { initialUrl: '/account' })

  await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { name: 'Groceries in minutes' })).toBeTruthy()
  expect(router.getPathname()).toBe('/')
  await waitFor(() => expect(getToken()).toBeUndefined())
  expect(calls.some((request) => request.method === 'POST' && new URL(request.url).pathname.endsWith('/auth/sign-out'))).toBe(true)
})
