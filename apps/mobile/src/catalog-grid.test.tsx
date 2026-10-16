import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './api'
import { ProductGrid } from './catalog-grid'
import { fakeCore, json } from './fake-core'
import { Text } from './ui/text'

// Core's page answer: `count` products numbered from `from`, of `total` in all.
function pageOf(page: number, count: number, total: number) {
  const from = (page - 1) * 24
  const items = Array.from({ length: count }, (_, i) => ({
    id: `p-${from + i + 1}`,
    name: `Item ${from + i + 1}`,
    slug: `item-${from + i + 1}`,
    unitLabel: '1 pc',
    mrpCents: 1000,
    priceCents: 900,
    categoryId: 'c-milk',
    inStock: true,
    quantity: 5,
  }))
  return { items, page, pageSize: 24, total }
}

// Core answers from the request's page parameter; the first page holds 24 of `total`.
function fakeProducts(total: number) {
  return fakeCore({
    'GET /stores/s-1/products': (request) => {
      const page = Number(new URL(request.url).searchParams.get('page') ?? 1)
      const count = Math.min(24, total - (page - 1) * 24)
      return json(200, pageOf(page, count, total))
    },
  })
}

function renderGrid() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ProductGrid storeId="s-1" filter={{}} empty={<Text>No products here yet</Text>} />
    </QueryClientProvider>,
  )
}

test('load more while pages remain', async () => {
  const calls = fakeProducts(30)
  await renderGrid()
  await screen.findByRole('link', { name: 'Item 24 1 pc' })
  expect(screen.getAllByRole('link')).toHaveLength(24)

  await fireEvent.press(screen.getByRole('button', { name: 'Load more' }))
  await screen.findByRole('link', { name: 'Item 30 1 pc' })
  expect(screen.getAllByRole('link')).toHaveLength(30)
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  expect(calls.map((request) => new URL(request.url).searchParams.get('page'))).toEqual(['1', '2'])
})

test('end of the list loads the next page', async () => {
  const calls = fakeProducts(30)
  await renderGrid()
  await screen.findByRole('button', { name: 'Load more' })

  const list = screen.getByTestId('product-grid')
  await fireEvent(list, 'endReached')
  await fireEvent(list, 'endReached')
  await screen.findByRole('link', { name: 'Item 30 1 pc' })

  const pages = calls.map((request) => new URL(request.url).searchParams.get('page'))
  expect(pages.filter((page) => page === '2')).toHaveLength(1)
})

test('no load more at the last page', async () => {
  fakeProducts(24)
  await renderGrid()
  await screen.findByRole('link', { name: 'Item 24 1 pc' })
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull())
})
