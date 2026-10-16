import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { coreUrl, queryClient } from './api'
import { findCategory, imageUri, stockLabel, usePicks, type CategoryNode, type StoreProduct } from './catalog'
import { fakeCore, json } from './fake-core'

function product(n: number, inStock = true): StoreProduct {
  return {
    id: `p-${n}`,
    name: `Item ${n}`,
    slug: `item-${n}`,
    unitLabel: '1 pc',
    mrpCents: 1000,
    priceCents: 900,
    categoryId: 'c-milk',
    inStock,
    quantity: inStock ? 5 : 0,
  }
}

const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children)

test('stock label reads the count', () => {
  expect(stockLabel(0)).toBeUndefined()
  expect(stockLabel(3)).toBe('Only 3 left')
  expect(stockLabel(10)).toBe('10+ left')
})

test('findCategory finds a child under its parent', () => {
  const tree: CategoryNode[] = [
    {
      id: 'c-dairy',
      name: 'Dairy, Bread & Eggs',
      slug: 'dairy-bread-eggs',
      sortOrder: 1,
      children: [{ id: 'c-milk', name: 'Milk', slug: 'milk', parentId: 'c-dairy', sortOrder: 1 }],
    },
  ]
  expect(findCategory(tree, 'milk')).toEqual({ parent: tree[0], selected: tree[0].children[0] })
  expect(findCategory(tree, 'nope')).toBeUndefined()
})

test('imageUrl prefixes the core origin', () => {
  expect(imageUri('/api/core/v1/files/milk.jpg')).toBe(`${coreUrl.replace('/api/core/v1', '')}/api/core/v1/files/milk.jpg`)
  expect(imageUri(undefined)).toBeUndefined()
})

test('picks are the first 12 in stock', async () => {
  // Page one holds 14 products; the 2nd and the 5th are out of stock.
  const items = Array.from({ length: 14 }, (_, i) => product(i + 1, ![2, 5].includes(i + 1)))
  fakeCore({
    'GET /stores/s-1/products': () => json(200, { items, page: 1, pageSize: 24, total: 14 }),
  })
  const hook = await renderHook(() => usePicks('s-1'), { wrapper })
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))
  const names = hook.result.current.data?.map((p) => p.name)
  expect(names).toEqual(items.filter((p) => p.inStock).slice(0, 12).map((p) => p.name))
  expect(names).toHaveLength(12)
})
