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
  fireEvent.press(screen.getByRole('button', { name: 'Close' }))
  fireEvent.press(screen.getByRole('button', { name: 'Close sheet' }))
  fireEvent(screen.getByText('Edit profile'), 'requestClose')
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
