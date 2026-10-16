import { render, screen } from '@testing-library/react-native'
import { Price } from './price'
import { colors } from './tokens'

test('price in rupees', async () => {
  await render(<Price cents={2900} />)
  expect(screen.getByText('₹29')).toHaveStyle({ color: colors.accent, fontVariant: ['tabular-nums'] })
})

test('mrp struck through when higher', async () => {
  await render(<Price cents={2700} mrpCents={3000} />)
  expect(screen.getByText('₹30')).toHaveStyle({ textDecorationLine: 'line-through', color: colors.inkMuted })
  expect(screen.getByLabelText('MRP ₹30')).toBeTruthy()
})

test('no mrp when equal', async () => {
  await render(<Price cents={2900} mrpCents={2900} />)
  expect(screen.queryByLabelText(/MRP/)).toBeNull()
})

test('paise shown', async () => {
  await render(<Price cents={123450} />)
  expect(screen.getByText('₹1,234.50')).toBeTruthy()
})

test('large size', async () => {
  await render(<Price cents={2900} size="lg" />)
  expect(screen.getByText('₹29')).toHaveStyle({ fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 26 })
})
