import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { CategoryGrid, ProductCard } from './catalog-card'
import type { StoreProduct } from './catalog'

const taaza: StoreProduct = {
  id: 'p-taaza',
  name: 'Amul Taaza',
  slug: 'amul-taaza',
  unitLabel: '500 ml',
  mrpCents: 2900,
  priceCents: 2700,
  categoryId: 'c-milk',
  inStock: true,
  quantity: 3,
}

test('card links and prices', async () => {
  await render(<ProductCard product={taaza} storeId="s-1" />)
  expect(screen.getByRole('link', { name: 'Amul Taaza 500 ml' })).toHaveProp('href', '/product/amul-taaza')
  expect(screen.getByText('Only 3 left')).toBeTruthy()
  expect(screen.getByText('₹27')).toBeTruthy()
  expect(screen.getByText('₹29')).toHaveStyle({ textDecorationLine: 'line-through' })
  expect(screen.getByTestId('image-placeholder')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Add Amul Taaza' })).toBeTruthy()
})

test('add shows the count', async () => {
  await render(<ProductCard product={taaza} storeId="s-1" />)
  await fireEvent.press(screen.getByRole('button', { name: 'Add Amul Taaza' }))
  const group = screen.getByLabelText('Quantity of Amul Taaza')
  expect(within(group).getByText('1')).toBeTruthy()
})

test('out-of-stock card', async () => {
  await render(<ProductCard product={{ ...taaza, inStock: false, quantity: 0 }} storeId="s-1" />)
  expect(screen.getByRole('button', { name: 'Out of stock' }).props.accessibilityState).toMatchObject({ disabled: true })
  expect(screen.queryByRole('button', { name: 'Add Amul Taaza' })).toBeNull()
  expect(screen.queryByText(/left/)).toBeNull()
})

test('category grid links each parent', async () => {
  await render(
    <CategoryGrid
      categories={[
        { id: 'c-dairy', name: 'Dairy, Bread & Eggs', slug: 'dairy-bread-eggs', sortOrder: 1 },
        { id: 'c-fruit', name: 'Fruits & Vegetables', slug: 'fruits-vegetables', sortOrder: 2 },
      ]}
    />,
  )
  expect(screen.getByRole('link', { name: 'Dairy, Bread & Eggs' })).toHaveProp('href', '/category/dairy-bread-eggs')
  expect(screen.getByRole('link', { name: 'Fruits & Vegetables' })).toHaveProp('href', '/category/fruits-vegetables')
})
