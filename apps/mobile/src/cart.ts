import { useSyncExternalStore } from 'react'
import type { ApiError } from './api'

// ponytail: in-memory counts, gone on reload; L3 replaces these bodies with the core cart and keeps the names.
export type CartSummary = { count: number; storeId?: string }

type Cart = { storeId?: string; quantities: Record<string, number>; summary: CartSummary }

const listeners = new Set<() => void>()
// Replaced, never mutated: useSyncExternalStore compares snapshots by identity.
let cart: Cart = { quantities: {}, summary: { count: 0 } }

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function update(storeId: string | undefined, quantities: Record<string, number>) {
  const count = Object.values(quantities).reduce((sum, n) => sum + n, 0)
  cart = { storeId, quantities, summary: { count, storeId } }
  listeners.forEach((listener) => listener())
}

export function useQuantity(productId: string): number {
  return useSyncExternalStore(
    subscribe,
    () => cart.quantities[productId] ?? 0,
    () => 0,
  )
}

// A count at another store first drops every count of the previous store, as core's cart does.
export function setQuantity(storeId: string, productId: string, quantity: number): void {
  const quantities = cart.storeId === storeId ? { ...cart.quantities } : {}
  if (quantity > 0) quantities[productId] = quantity
  else delete quantities[productId]
  update(storeId, quantities)
}

export function getCartSummary(): CartSummary {
  return cart.summary
}

export function useCartSummary(): CartSummary {
  return useSyncExternalStore(subscribe, getCartSummary, getCartSummary)
}

export async function clearCart(): Promise<ApiError | undefined> {
  update(undefined, {})
  return undefined
}
