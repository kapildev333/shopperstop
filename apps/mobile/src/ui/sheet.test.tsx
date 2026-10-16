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
  // Walk up from the content to the nearest scroll view (the jest mock renders it as the host RCTScrollView).
  let scroll = screen.getByText('Name field')
  while (scroll.type !== 'RCTScrollView' && scroll.parent) scroll = scroll.parent
  expect(scroll.type).toBe('RCTScrollView')
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled')
})

// The dialog is named by its title: react-native-web gives the Modal's root the dialog role and this label.
test('sheet dialog is named by its title', async () => {
  await render(
    <Sheet open title="Add address" onClose={() => {}}>
      <Text>Name field</Text>
    </Sheet>,
  )
  let modal = screen.getByText('Add address')
  while (!('onRequestClose' in modal.props) && modal.parent) modal = modal.parent
  expect(modal.props.accessibilityLabel).toBe('Add address')
})

// The footer (artboard 4's Proceed bar) stays put while the cart scrolls: it sits after the ScrollView, not inside it.
test('footer stays below the scroll', async () => {
  await render(
    <Sheet open title="My cart" onClose={() => {}} footer={<Text>Proceed</Text>}>
      <Text>Cart line</Text>
    </Sheet>,
  )
  expect(screen.getByText('Proceed')).toBeTruthy()
  const footer = screen.getByText('Proceed')
  let insideScroll = false
  for (let node = footer.parent; node; node = node.parent) {
    if (node.type === 'RCTScrollView') insideScroll = true
  }
  expect(insideScroll).toBe(false)
  let scroll = screen.getByText('Cart line')
  while (scroll.type !== 'RCTScrollView' && scroll.parent) scroll = scroll.parent
  expect(scroll.type).toBe('RCTScrollView')
})
