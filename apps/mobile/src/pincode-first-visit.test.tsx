import { screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

const appDir = `${__dirname}/app`

test('first visit opens the pincode sheet', async () => {
  await renderRouter(appDir, { initialUrl: '/' })
  expect(await screen.findByText('Where should we deliver?')).toBeTruthy()
  expect(screen.getByLabelText('Pincode')).toHaveProp('value', '')
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
})
