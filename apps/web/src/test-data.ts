import { createElement } from 'react'
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import type { components } from '@shopperstop/ui/api'
import { routeTree } from './routeTree.gen'

export type Store = components['schemas']['Store']

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

export function renderAt(path: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) })
  render(createElement(RouterProvider, { router }))
  return router
}
