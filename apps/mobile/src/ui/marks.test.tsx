import { fireEvent, render, screen } from '@testing-library/react-native'
import { Badge } from './badge'
import { Chip } from './chip'
import { colors } from './tokens'

test('badge shows its text', async () => {
  await render(<Badge variant="accent">Default</Badge>)
  expect(screen.getByText('Default')).toHaveStyle({ backgroundColor: colors.accentSoft })
})

test('chip selected state', async () => {
  const onPress = jest.fn()
  await render(
    <>
      <Chip selected onPress={onPress}>Work</Chip>
      <Chip selected={false} onPress={onPress}>Home</Chip>
    </>,
  )
  const work = screen.getByRole('button', { name: 'Work' })
  expect(work).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }))
  expect(work).toHaveStyle({ borderColor: colors.accent, backgroundColor: colors.accentSoft })
  const home = screen.getByRole('button', { name: 'Home' })
  expect(home).toHaveProp('accessibilityState', expect.objectContaining({ selected: false }))
  expect(home).toHaveStyle({ borderColor: colors.lineStrong })
  fireEvent.press(work)
  expect(onPress).toHaveBeenCalledTimes(1)
})

test('chip tap target', async () => {
  await render(<Chip selected={false} onPress={() => {}}>Other</Chip>)
  expect(screen.getByRole('button', { name: 'Other' })).toHaveStyle({ minHeight: 44 })
})
