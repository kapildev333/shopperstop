import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { queryClient } from './api'
import { fakeCore, json } from './fake-core'
import { setPincode } from './pincode'
import { resolvePincode } from './serviceability'
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
  await render(<QueryClientProvider client={queryClient}><ProductCard product={taaza} storeId="s-1" /></QueryClientProvider>)
  expect(screen.getByRole('link', { name: 'Amul Taaza 500 ml' })).toHaveProp('href', '/product/amul-taaza')
  expect(screen.getByText('Only 3 left')).toBeTruthy()
  expect(screen.getByText('₹27')).toBeTruthy()
  expect(screen.getByText('₹29')).toHaveStyle({ textDecorationLine: 'line-through' })
  expect(screen.getByTestId('image-placeholder')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Add Amul Taaza' })).toBeTruthy()
})

test('add shows the count', async () => {
  // The card sits behind the store gate in the app: its store is resolved first, here with the card's own id.
  setPincode('560034')
  fakeCore({
    'GET /serviceability': () =>
      json(200, { store: { id: 's-1', name: 'Koramangala', isOpen: true, deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900, promisedMinutes: 10 } }),
  })
  await resolvePincode('560034')
  await render(<QueryClientProvider client={queryClient}><ProductCard product={taaza} storeId="s-1" /></QueryClientProvider>)
  await fireEvent.press(screen.getByRole('button', { name: 'Add Amul Taaza' }))
  const group = screen.getByLabelText('Quantity of Amul Taaza')
  expect(within(group).getByText('1')).toBeTruthy()
})

test('out-of-stock card', async () => {
  await render(<QueryClientProvider client={queryClient}><ProductCard product={{ ...taaza, inStock: false, quantity: 0 }} storeId="s-1" /></QueryClientProvider>)
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
