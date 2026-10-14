import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { queryClient } from './api'
import { keys } from './catalog'
import { setPincode } from './pincode'
import { category, product, renderAt, store } from './test-data'

const dairy = category({
  id: '00000000-0000-4000-8000-000000000511',
  name: 'Dairy, Bread & Eggs',
  slug: 'dairy-bread-eggs',
  sortOrder: 1,
  children: [
    category({ id: '00000000-0000-4000-8000-000000000512', name: 'Milk', slug: 'milk', sortOrder: 0 }),
    category({ id: '00000000-0000-4000-8000-000000000513', name: 'Eggs', slug: 'eggs', sortOrder: 1 }),
  ],
})

function seedStoreAndTree() {
  setPincode('560034')
  queryClient.setQueryData(keys.serviceability('560034'), store())
  queryClient.setQueryData(keys.categories(store().id), [dairy])
}

// A paged answer: the first page of a feed, as useInfiniteQuery holds it.
function seedFeed(filter: { categoryId?: string; q?: string }, items: number, total: number) {
  const list = {
    items: Array.from({ length: items }, (_, i) =>
      product({
        id: `00000000-0000-4000-8000-0000000080${String(i).padStart(2, '0')}`,
        name: `Item ${i + 1}`,
        slug: `item-${i + 1}`,
      }),
    ),
    page: 1,
    pageSize: 24,
    total,
  }
  queryClient.setQueryData(keys.feed(store().id, filter), { pages: [list], pageParams: [1] })
}

test('category tabs', async () => {
  seedStoreAndTree()
  seedFeed({ categoryId: dairy.id }, 2, 2)
  seedFeed({ categoryId: dairy.children[0].id }, 2, 2)
  const router = renderAt('/c/dairy-bread-eggs')
  const user = userEvent.setup()

  expect(await screen.findByRole('heading', { level: 1, name: 'Dairy, Bread & Eggs' })).toBeInTheDocument()
  const tabs = within(screen.getByRole('group', { name: 'Subcategories' }))
  expect(tabs.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  expect(tabs.getByRole('button', { name: 'Milk' })).toHaveAttribute('aria-pressed', 'false')

  await user.click(tabs.getByRole('button', { name: 'Milk' }))
  expect(router.state.location.pathname).toBe('/c/milk')
  expect(screen.getByRole('button', { name: 'Milk' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('heading', { level: 1, name: 'Dairy, Bread & Eggs' })).toBeInTheDocument()
})

test('unknown category', async () => {
  seedStoreAndTree()
  renderAt('/c/nope')
  expect(await screen.findByRole('heading', { level: 1, name: 'Category not found' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/')
})

test('load more while pages remain', async () => {
  seedStoreAndTree()
  seedFeed({ categoryId: dairy.id }, 24, 30)
  renderAt('/c/dairy-bread-eggs')
  expect(await screen.findAllByRole('link', { name: /Item \d+ / })).toHaveLength(24)
  expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument()

  // The same page with total 24 has nothing after it.
  cleanup()
  queryClient.clear()
  seedStoreAndTree()
  seedFeed({ categoryId: dairy.id }, 24, 24)
  renderAt('/c/dairy-bread-eggs')
  expect(await screen.findAllByRole('link', { name: /Item \d+ / })).toHaveLength(24)
  expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
})
