import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { queryClient } from './api'
import { keys } from './catalog'
import { setPincode } from './pincode'
import { category, renderAt, store } from './test-data'

test('no results suggests categories', async () => {
  setPincode('560034')
  queryClient.setQueryData(keys.serviceability('560034'), store())
  queryClient.setQueryData(keys.categories(store().id), [
    category({ id: '00000000-0000-4000-8000-000000000501', name: 'Fruits & Vegetables', slug: 'fruits-vegetables' }),
    category({ id: '00000000-0000-4000-8000-000000000502', name: 'Dairy, Bread & Eggs', slug: 'dairy-bread-eggs' }),
  ])
  queryClient.setQueryData(keys.feed(store().id, { q: 'zzz' }), {
    pages: [{ items: [], page: 1, pageSize: 24, total: 0 }],
    pageParams: [1],
  })
  renderAt('/search?q=zzz')

  expect(await screen.findByRole('heading', { level: 1, name: 'Results for “zzz”' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'No results for “zzz”' })).toBeInTheDocument()
  const suggestions = within(screen.getByRole('heading', { level: 2, name: 'No results for “zzz”' }).parentElement!)
  expect(suggestions.getByRole('link', { name: 'Fruits & Vegetables' })).toHaveAttribute('href', '/c/fruits-vegetables')
  expect(suggestions.getByRole('link', { name: 'Dairy, Bread & Eggs' })).toHaveAttribute('href', '/c/dairy-bread-eggs')
})
