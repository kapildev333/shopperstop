import { fireEvent, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// The real route files under src/app: the root layout, the tabs and the not-found screen.
const appDir = `${__dirname}/app`

test('home in the tabs', async () => {
  await renderRouter(appDir, { initialUrl: '/' })
  expect(await screen.findByRole('heading', { name: 'Groceries in minutes' })).toBeTruthy()
  expect(screen.getAllByText(/^(Home|Categories|Orders)$/).map((label) => label.props.children)).toEqual([
    'Home',
    'Categories',
    'Orders',
  ])
  expect(screen.getByRole('button', { name: 'Home', selected: true })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy()
})

test('unknown path', async () => {
  await renderRouter(appDir, { initialUrl: '/nope' })
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy()
  fireEvent.press(screen.getByRole('link', { name: 'Go to Home' }))
  expect(await screen.findByRole('heading', { name: 'Groceries in minutes' })).toBeTruthy()
})
