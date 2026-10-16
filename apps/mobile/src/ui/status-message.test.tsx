import { render, screen } from '@testing-library/react-native'
import { StatusMessage } from './status-message'
import { colors } from './tokens'

test('status message is a polite status', async () => {
  await render(<StatusMessage tone="success">Saved</StatusMessage>)
  const region = screen.getByRole('status')
  expect(region).toHaveProp('accessibilityLiveRegion', 'polite')
  expect(screen.getByText('Saved')).toBeTruthy()
})

test('tones use tokens', async () => {
  await render(<StatusMessage tone="warning">Stock is low</StatusMessage>)
  expect(screen.getByRole('status')).toHaveStyle({ backgroundColor: colors.warningSoft })
  expect(screen.getByText('Stock is low')).toHaveStyle({ color: colors.ink })
})

test('success tone uses the success surface', async () => {
  await render(<StatusMessage tone="success">Saved</StatusMessage>)
  expect(screen.getByRole('status')).toHaveStyle({ backgroundColor: colors.successSoft })
  expect(screen.getByTestId('status-icon', { includeHiddenElements: true })).toBeTruthy()
})
