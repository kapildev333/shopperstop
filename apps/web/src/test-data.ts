import { createElement, type ReactNode } from 'react'
import { render, waitFor } from '@testing-library/react'
import { QueryClientProvider, type QueryKey } from '@tanstack/react-query'
import { expect } from 'vitest'
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
export type Address = components['schemas']['Address']

// Test-only: never imported by app code.
export function address(overrides: Partial<Address> = {}): Address {
  return {
    id: '00000000-0000-4000-8000-000000000301',
    label: 'Home',
    line1: '12 80 Feet Rd, Koramangala',
    pincode: '560034',
    isDefault: true,
    ...overrides,
  }
}


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

// An answer older than the catalog staleTime: the view that mounts on it refetches, and under jsdom that refetch fails.
export function seedStale(key: QueryKey, data: unknown): void {
  queryClient.setQueryData(key, data, { updatedAt: Date.now() - 61_000 })
}

// Resolves once that refetch has failed with the seeded answer still held.
export async function refetchFailed(key: QueryKey): Promise<void> {
  await waitFor(() => expect(queryClient.getQueryState(key)).toMatchObject({ status: 'error', fetchStatus: 'idle' }))
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
