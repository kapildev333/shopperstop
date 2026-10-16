import { fireEvent, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import Account from './app/account'
import SignIn from './app/sign-in'
import { fakeCore, json } from './fake-core'
import { getToken } from './session'

const customer = { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.com', name: 'Asha Rao' }

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('Sign in returns to the account', async () => {
  fakeCore({
    'POST /auth/sign-in': () => json(200, { token: 't-new', customer }),
    'GET /me': () => json(200, customer),
    'GET /me/addresses': () => json(200, { items: [] }),
  })
  const router = await renderRouter({ account: Account, 'sign-in': SignIn }, { initialUrl: '/sign-in?returnTo=%2Faccount' })

  await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.com')
  await fireEvent.changeText(screen.getByLabelText('Password'), 'secret-pass')
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('heading', { name: 'My account' })).toBeTruthy()
  expect(router.getPathname()).toBe('/account')
  expect(getToken()).toBe('t-new')
})
