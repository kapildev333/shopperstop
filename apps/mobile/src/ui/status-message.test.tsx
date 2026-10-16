import { render, screen } from '@testing-library/react-native'
import { CircleCheck, TriangleAlert } from 'lucide-react-native'
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
  expect(screen.UNSAFE_getByType(TriangleAlert)).toHaveProp('color', colors.warning)
  expect(screen.getByText('Stock is low')).toHaveStyle({ color: colors.ink })
})

test('success tone uses the success icon and surface', async () => {
  await render(<StatusMessage tone="success">Saved</StatusMessage>)
  expect(screen.getByRole('status')).toHaveStyle({ backgroundColor: colors.successSoft })
  expect(screen.UNSAFE_getByType(CircleCheck)).toHaveProp('color', colors.success)
})
