import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { fakeCore, json } from './fake-core'
import { setToken } from './session'

jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

const appDir = `${__dirname}/app`

// Own file: one navigating test per file.
test('Start shopping opens Home', async () => {
  setToken('t-start')
  fakeCore({ 'GET /orders': () => json(200, { items: [], total: 0 }) })
  const router = await renderRouter(appDir, { initialUrl: '/orders' })

  await fireEvent.press(await screen.findByRole('button', { name: 'Start shopping' }))

  await waitFor(() => expect(router.getPathname()).toBe('/'))
})
