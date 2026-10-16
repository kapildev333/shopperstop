import { render, screen } from '@testing-library/react-native'
import { Image } from 'react-native'
import { ImageTile } from './image-tile'
import { colors } from './tokens'

test('image from uri', async () => {
  await render(<ImageTile uri="https://core.example/img/milk.png" />)
  expect(screen.UNSAFE_getByType(Image)).toHaveProp('source', { uri: 'https://core.example/img/milk.png' })
  expect(screen.UNSAFE_getByType(Image)).toHaveProp('resizeMode', 'contain')
  expect(screen.queryByTestId('image-placeholder')).toBeNull()
})

test('placeholder without uri', async () => {
  await render(<ImageTile />)
  expect(screen.UNSAFE_queryByType(Image)).toBeNull()
  expect(screen.getByTestId('image-placeholder')).toHaveStyle({ backgroundColor: colors.canvas })
})
