import { render, screen } from '@testing-library/react-native'
import { Text } from './text'
import { colors } from './tokens'

test('body text by default', async () => {
  await render(<Text>Hello</Text>)
  expect(screen.getByText('Hello')).toHaveStyle({
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  })
})

test('variant picks the family by weight', async () => {
  await render(
    <>
      <Text variant="display">Big</Text>
      <Text variant="h3">Mid</Text>
    </>,
  )
  expect(screen.getByText('Big')).toHaveStyle({ fontFamily: 'Inter_700Bold', fontSize: 28, lineHeight: 34 })
  expect(screen.getByText('Mid')).toHaveStyle({ fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22 })
})

test('tone', async () => {
  await render(
    <>
      <Text tone="inkMuted">Muted</Text>
      <Text tone="danger">Bad</Text>
      <Text tone="accent">Go</Text>
      <Text tone="onBrand">Brand</Text>
      <Text tone="onAccent">Action</Text>
    </>,
  )
  expect(screen.getByText('Muted')).toHaveStyle({ color: colors.inkMuted })
  expect(screen.getByText('Bad')).toHaveStyle({ color: colors.danger })
  expect(screen.getByText('Go')).toHaveStyle({ color: colors.accent })
  expect(screen.getByText('Brand')).toHaveStyle({ color: colors.onBrand })
  expect(screen.getByText('Action')).toHaveStyle({ color: colors.onAccent })
})

test('heading is announced', async () => {
  await render(<Text variant="h1" heading={1}>Groceries in minutes</Text>)
  expect(screen.getByRole('heading', { name: 'Groceries in minutes' })).toBeTruthy()
})

test('tabular numbers', async () => {
  await render(<Text tabular>1,234.50</Text>)
  expect(screen.getByText('1,234.50')).toHaveStyle({ fontVariant: ['tabular-nums'] })
})
