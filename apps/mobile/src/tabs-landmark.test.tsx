import { screen, within } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('tab bar in a navigation landmark', async () => {
  await renderRouter(`${__dirname}/app`, { initialUrl: '/' })

  const landmark = await screen.findByRole('navigation', { name: 'Main' })
  expect(within(landmark).getByRole('button', { name: 'Home' })).toBeTruthy()
  expect(within(landmark).getByRole('button', { name: 'Categories' })).toBeTruthy()
  expect(within(landmark).getByRole('button', { name: 'Orders' })).toBeTruthy()
})
