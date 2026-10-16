import { ScrollView } from 'react-native'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from './text'
import { Sheet } from './sheet'

test('sheet shows its title and content', async () => {
  await render(
    <Sheet open title="Edit profile" onClose={() => {}}>
      <Text>Name field</Text>
    </Sheet>,
  )
  expect(screen.getByRole('heading', { name: 'Edit profile' })).toBeTruthy()
  expect(screen.getByText('Name field')).toBeTruthy()
})

test('sheet closed', async () => {
  const onClose = jest.fn()
  await render(
    <Sheet open title="Edit profile" onClose={onClose}>
      <Text>Name field</Text>
    </Sheet>,
  )
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Close sheet' }))
  // The platform asks the modal to close (Android back, Escape on the web export): call the Modal's own handler.
  let modal = screen.getByText('Edit profile')
  while (!('onRequestClose' in modal.props) && modal.parent) modal = modal.parent
  modal.props.onRequestClose()
  expect(onClose).toHaveBeenCalledTimes(3)
})

test('sheet closed title is hidden', async () => {
  await render(
    <Sheet open={false} title="Edit profile" onClose={() => {}}>
      <Text>Name field</Text>
    </Sheet>,
  )
  expect(screen.queryByText('Edit profile')).toBeNull()
})

// A tall form (the address sheet) must scroll inside the panel instead of running off a small screen.
test('sheet content scrolls', async () => {
  await render(
    <Sheet open title="Add address" onClose={() => {}}>
      <Text>Name field</Text>
    </Sheet>,
  )
  // Walk up from the content to the nearest scroll view; the content must sit inside it.
  let scroll = screen.getByText('Name field')
  while ((scroll.type as unknown) !== ScrollView && scroll.parent) scroll = scroll.parent
  expect(scroll.type as unknown).toBe(ScrollView)
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled')
})
