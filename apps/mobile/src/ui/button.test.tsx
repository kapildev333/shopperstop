import { fireEvent, render, screen } from '@testing-library/react-native'
import { X } from 'lucide-react-native'
import { Button, IconButton } from './button'
import { colors } from './tokens'

test('button presses', async () => {
  const onPress = jest.fn()
  await render(<Button onPress={onPress}>Save</Button>)
  fireEvent.press(screen.getByRole('button', { name: 'Save' }))
  expect(onPress).toHaveBeenCalledTimes(1)
})

test('disabled button does not press', async () => {
  const onPress = jest.fn()
  await render(
    <Button disabled onPress={onPress}>
      Save
    </Button>,
  )
  const button = screen.getByRole('button', { name: 'Save' })
  expect(button.props.accessibilityState).toMatchObject({ disabled: true })
  fireEvent.press(button)
  expect(onPress).not.toHaveBeenCalled()
})

test('loading button is busy and disabled', async () => {
  const onPress = jest.fn()
  await render(
    <Button loading onPress={onPress}>
      Save
    </Button>,
  )
  const button = screen.getByRole('button', { name: 'Save' })
  expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true })
  fireEvent.press(button)
  expect(onPress).not.toHaveBeenCalled()
})

test('variants use tokens', async () => {
  await render(
    <>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="ghostDanger">Remove</Button>
    </>,
  )
  expect(screen.getByRole('button', { name: 'Primary' })).toHaveStyle({ backgroundColor: colors.accent })
  expect(screen.getByText('Primary')).toHaveStyle({ color: colors.onAccent })
  expect(screen.getByRole('button', { name: 'Secondary' })).toHaveStyle({
    borderColor: colors.lineStrong,
    borderWidth: 1,
  })
  expect(screen.getByText('Secondary')).toHaveStyle({ color: colors.ink })
  expect(screen.getByText('Danger')).toHaveStyle({ color: colors.danger })
  expect(screen.getByText('Ghost')).toHaveStyle({ color: colors.accent })
  expect(screen.getByText('Remove')).toHaveStyle({ color: colors.danger })
})

test('sizes', async () => {
  await render(
    <>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </>,
  )
  expect(screen.getByRole('button', { name: 'Medium' })).toHaveStyle({ minHeight: 44 })
  expect(screen.getByRole('button', { name: 'Large' })).toHaveStyle({ minHeight: 48 })
})

test('icon button needs a label', async () => {
  const onPress = jest.fn()
  await render(<IconButton label="Close" icon={X} onPress={onPress} />)
  const button = screen.getByRole('button', { name: 'Close' })
  expect(button).toHaveStyle({ width: 44, height: 44 })
  fireEvent.press(button)
  expect(onPress).toHaveBeenCalledTimes(1)
})

test('button accessible name overrides the visible text', async () => {
  const onPress = jest.fn()
  await render(
    <Button accessibilityLabel="Edit profile" onPress={onPress}>
      Edit
    </Button>,
  )
  expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  fireEvent.press(screen.getByRole('button', { name: 'Edit profile' }))
  expect(onPress).toHaveBeenCalledTimes(1)
})

test('button icon is 16 px in the label tone', async () => {
  // A probe icon records the props Button gives it; no Lucide render needed.
  const seen: { size?: number; color?: string }[] = []
  const Probe = (props: { size?: number; color?: string }) => {
    seen.push(props)
    return null
  }
  await render(
    <>
      <Button icon={Probe}>Save</Button>
      <Button variant="ghost" icon={Probe}>Add</Button>
    </>,
  )
  expect(seen[0]).toEqual({ size: 16, color: colors.onAccent })
  expect(seen[seen.length - 1]).toEqual({ size: 16, color: colors.accent })
})
