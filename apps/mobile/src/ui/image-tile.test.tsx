import { render, screen } from '@testing-library/react-native'
import { ImageTile } from './image-tile'
import { colors } from './tokens'

test('image from uri', async () => {
  await render(<ImageTile uri="https://core.example/img/milk.png" />)
  // The image is hidden from assistive technology, so the query includes hidden elements.
  const image = screen.getByTestId('image-tile-image', { includeHiddenElements: true })
  expect(image).toHaveProp('source', { uri: 'https://core.example/img/milk.png' })
  expect(image).toHaveProp('resizeMode', 'contain')
  expect(screen.queryByTestId('image-placeholder')).toBeNull()
})

test('placeholder without uri', async () => {
  await render(<ImageTile />)
  expect(screen.queryByTestId('image-tile-image', { includeHiddenElements: true })).toBeNull()
  expect(screen.getByTestId('image-placeholder')).toHaveStyle({ backgroundColor: colors.canvas })
})
