import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// Own file: expo-router keeps its navigation ref at module level and no reset is exported, so a
// tab press here would leak into later renderRouter calls in the same file. Per-file isolation is the rule.
test('tab switch', async () => {
  await renderRouter(`${__dirname}/app`, { initialUrl: '/' })
  expect(await screen.findByRole('heading', { name: 'Groceries in minutes' })).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Orders' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Orders', selected: true })).toBeTruthy())
  expect(screen.queryByRole('heading', { name: 'Groceries in minutes' })).toBeNull()
  expect(screen.getByRole('heading', { name: 'Your orders' })).toBeTruthy()
})
