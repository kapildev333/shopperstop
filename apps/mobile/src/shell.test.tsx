import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'

// The real route files under src/app: the root layout, the tabs and the not-found screen.
test('home in the tabs', async () => {
  await renderRouter('./app', { initialUrl: '/' })
  expect(await screen.findByRole('heading', { name: 'Groceries in minutes' })).toBeTruthy()
  expect(screen.getByRole('tab', { name: 'Home', selected: true })).toBeTruthy()
  expect(screen.getByRole('tab', { name: 'Categories' })).toBeTruthy()
  expect(screen.getByRole('tab', { name: 'Orders' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy()
})

test('tab switch', async () => {
  await renderRouter('./app', { initialUrl: '/' })
  expect(await screen.findByRole('heading', { name: 'Groceries in minutes' })).toBeTruthy()
  fireEvent.press(screen.getByRole('tab', { name: 'Orders' }))
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Orders', selected: true })).toBeTruthy())
  expect(screen.queryByRole('heading', { name: 'Groceries in minutes' })).toBeNull()
  expect(screen.getByRole('heading', { name: 'Your orders' })).toBeTruthy()
})

test('unknown path', async () => {
  await renderRouter('./app', { initialUrl: '/nope' })
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy()
  fireEvent.press(screen.getByRole('link', { name: 'Go to Home' }))
  expect(await screen.findByRole('heading', { name: 'Groceries in minutes' })).toBeTruthy()
})
