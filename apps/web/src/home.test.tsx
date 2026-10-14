import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { queryClient } from './api'
import { keys } from './catalog'
import { setPincode } from './pincode'
import { category, product, refetchFailed, renderAt, seedStale, store } from './test-data'

test('home lists categories and picks', async () => {
  setPincode('560034')
  queryClient.setQueryData(keys.serviceability('560034'), store())
  queryClient.setQueryData(keys.categories(store().id), [
    category({ id: '00000000-0000-4000-8000-000000000501', name: 'Fruits & Vegetables', slug: 'fruits-vegetables' }),
    category({ id: '00000000-0000-4000-8000-000000000502', name: 'Dairy, Bread & Eggs', slug: 'dairy-bread-eggs' }),
    category({ id: '00000000-0000-4000-8000-000000000503', name: 'Snacks', slug: 'snacks' }),
  ])
  // Products 2 and 5 are out of stock; the page holds 14.
  const page = Array.from({ length: 14 }, (_, i) =>
    product({
      id: `00000000-0000-4000-8000-0000000007${String(i).padStart(2, '0')}`,
      name: `Product ${i + 1}`,
      slug: `product-${i + 1}`,
      unitLabel: '500 ml',
      inStock: i !== 1 && i !== 4,
      quantity: i !== 1 && i !== 4 ? 10 : 0,
    }),
  )
  queryClient.setQueryData(keys.picked(store().id), page)
  renderAt('/')

  const nav = await screen.findByRole('navigation', { name: 'Categories' })
  const shop = screen.getByRole('region', { name: 'Shop by category' })
  for (const region of [nav, shop]) {
    expect(within(region).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/c/fruits-vegetables',
      '/c/dairy-bread-eggs',
      '/c/snacks',
    ])
  }

  const picked = within(screen.getByRole('region', { name: 'Picked for you' })).getAllByRole('link')
  expect(picked.map((link) => link.textContent)).toEqual([
    'Product 1 500 ml',
    'Product 3 500 ml',
    'Product 4 500 ml',
    'Product 6 500 ml',
    'Product 7 500 ml',
    'Product 8 500 ml',
    'Product 9 500 ml',
    'Product 10 500 ml',
    'Product 11 500 ml',
    'Product 12 500 ml',
    'Product 13 500 ml',
    'Product 14 500 ml',
  ])
})

test('failed refetch keeps home', async () => {
  setPincode('560034')
  queryClient.setQueryData(keys.serviceability('560034'), store())
  seedStale(keys.categories(store().id), [
    category({ name: 'Snacks', slug: 'snacks' }),
  ])
  seedStale(keys.picked(store().id), [product({ name: 'Amul Taaza' })])
  renderAt('/')
  await refetchFailed(keys.categories(store().id))
  await refetchFailed(keys.picked(store().id))
  expect(screen.getByRole('navigation', { name: 'Categories' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Picked for you' })).toHaveTextContent('Amul Taaza')
  expect(screen.queryAllByRole('alert')).toEqual([])
})

test('home alerts with nothing held', async () => {
  setPincode('560034')
  queryClient.setQueryData(keys.serviceability('560034'), store())
  renderAt('/')
  await screen.findByText('Could not load categories.')
  await screen.findByText('Could not load products.')
  expect(screen.getAllByRole('alert')).toHaveLength(2)
})
