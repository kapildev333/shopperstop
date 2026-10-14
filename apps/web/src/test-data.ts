import { createElement, type ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import type { components } from '@shopperstop/ui/api'
import { queryClient } from './api'
import { routeTree } from './routeTree.gen'

export type Store = components['schemas']['Store']
export type StoreProduct = components['schemas']['StoreProduct']
export type CategoryNode = components['schemas']['CategoryNode']

// Test-only: never imported by app code.
export function store(overrides: Partial<Store> = {}): Store {
  return {
    id: '00000000-0000-4000-8000-000000000401',
    name: 'Koramangala',
    isOpen: true,
    deliveryFeeCents: 2500,
    freeDeliveryAboveCents: 0,
    minOrderCents: 0,
    promisedMinutes: 10,
    ...overrides,
  }
}

export function product(overrides: Partial<StoreProduct> = {}): StoreProduct {
  return {
    id: '00000000-0000-4000-8000-000000000601',
    name: 'Amul Taaza',
    slug: 'amul-taaza',
    unitLabel: '500 ml',
    mrpCents: 2900,
    priceCents: 2700,
    categoryId: '00000000-0000-4000-8000-000000000521',
    inStock: true,
    quantity: 10,
    ...overrides,
  }
}

// A parent by default; a tree node with children: [] (CategoryNode is a Category too).
export function category(overrides: Partial<CategoryNode> = {}): CategoryNode {
  return {
    id: '00000000-0000-4000-8000-000000000501',
    name: 'Fruits & Vegetables',
    slug: 'fruits-vegetables',
    sortOrder: 0,
    children: [],
    ...overrides,
  }
}

export function renderAt(path: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) })
  render(createElement(RouterProvider, { router }))
  return router
}

// Renders a component that holds router Links, under a root route with no other pages.
export function renderInRouter(ui: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => createElement(QueryClientProvider, { client: queryClient }, ui) }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(createElement(RouterProvider, { router }))
  return router
}
