import { useSyncExternalStore } from 'react'

// Structural subset of core's StoreProduct: the generated type is assignable to it.
export type CartProduct = {
  id: string
  name: string
  slug: string
  unitLabel: string
  priceCents: number
  mrpCents: number
  imageUrl?: string
  inStock: boolean
  quantity: number
}
export type CartLine = { product: CartProduct; quantity: number }
export type GuestCart = { storeId?: string; items: CartLine[] }
export type CartFees = { deliveryFeeCents: number; freeDeliveryAboveCents: number; minOrderCents: number }
export type CartView = GuestCart & {
  subtotalCents: number
  deliveryFeeCents: number
  totalCents: number
  minOrderCents: number
  shortfallCents: number
  clamped?: boolean
}
export type CartAction = { type: 'set'; storeId: string; product: CartProduct; quantity: number } | { type: 'clear' }

export const lineCap = 20
export const emptyCart: GuestCart = { items: [] }

export function maxQuantity(product: CartProduct): number {
  return product.inStock ? Math.min(product.quantity, lineCap) : 0
}

// Absolute quantities (core's semantics). A positive quantity at another store replaces the cart.
export function cartReducer(state: GuestCart, action: CartAction): GuestCart {
  if (action.type === 'clear') return emptyCart
  const { product } = action
  const quantity = Math.max(0, Math.min(Math.trunc(action.quantity) || 0, maxQuantity(product)))
  let base = state.items
  if (state.storeId && state.storeId !== action.storeId) {
    if (quantity === 0) return state
    base = []
  }
  const index = base.findIndex((line) => line.product.id === product.id)
  let items: CartLine[]
  if (index < 0) items = quantity > 0 ? [...base, { product, quantity }] : base
  else if (quantity === 0) items = base.filter((_, i) => i !== index)
  else items = base.map((line, i) => (i === index ? { product, quantity } : line))
  if (items === state.items) return state
  if (items.length === 0) return emptyCart
  return { storeId: action.storeId, items }
}

// Core's formula: free delivery at or above the threshold; shortfall never below 0. No fees (store not resolved) means zero fee and shortfall.
export function cartView(cart: GuestCart, fees?: CartFees): CartView {
  if (cart.items.length === 0) {
    return { items: [], subtotalCents: 0, deliveryFeeCents: 0, totalCents: 0, minOrderCents: 0, shortfallCents: 0 }
  }
  const { deliveryFeeCents, freeDeliveryAboveCents, minOrderCents } = fees ?? {
    deliveryFeeCents: 0,
    freeDeliveryAboveCents: 0,
    minOrderCents: 0,
  }
  const subtotalCents = cart.items.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0)
  const feeCents = subtotalCents >= freeDeliveryAboveCents ? 0 : deliveryFeeCents
  return {
    ...cart,
    subtotalCents,
    deliveryFeeCents: feeCents,
    totalCents: subtotalCents + feeCents,
    minOrderCents,
    shortfallCents: Math.max(0, freeDeliveryAboveCents - subtotalCents),
  }
}

export function mergeBodies(cart: GuestCart): { storeId: string; productId: string; quantity: number }[] {
  const { storeId } = cart
  if (!storeId) return []
  return cart.items.map((line) => ({ storeId, productId: line.product.id, quantity: line.quantity }))
}

export function itemCount(cart: GuestCart): number {
  return cart.items.reduce((sum, line) => sum + line.quantity, 0)
}

const key = 'shopperstop:cart'
const listeners = new Set<() => void>()

// Only a shape the site writes is kept; anything else reads as an empty cart.
function parse(raw: unknown): GuestCart {
  if (!raw || typeof raw !== 'object') return emptyCart
  const { storeId, items } = raw as { storeId?: unknown; items?: unknown }
  if (!Array.isArray(items)) return emptyCart
  if (items.length === 0) return emptyCart
  if (typeof storeId !== 'string') return emptyCart
  const valid = items.every((item) => {
    const line = item as { product?: { id?: unknown }; quantity?: unknown }
    return (
      typeof line?.product?.id === 'string' &&
      Number.isInteger(line.quantity) &&
      (line.quantity as number) >= 1 &&
      (line.quantity as number) <= lineCap
    )
  })
  return valid ? { storeId, items: items as CartLine[] } : emptyCart
}

// Storage can be blocked or full (privacy modes, disabled cookies); the cart then lives in memory only.
function read(): GuestCart {
  try {
    return parse(JSON.parse(localStorage.getItem(key) ?? 'null'))
  } catch {
    return emptyCart
  }
}

let cart: GuestCart = read()

export function getGuestCart(): GuestCart {
  return cart
}

export function dispatchGuest(action: CartAction): void {
  const next = cartReducer(cart, action)
  if (next === cart) return
  cart = next
  listeners.forEach((listener) => listener())
  try {
    if (next.items.length > 0) localStorage.setItem(key, JSON.stringify(next))
    else localStorage.removeItem(key)
  } catch {
    // Not persisted; the in-memory cart above still applies for this page.
  }
}

export function clearGuestCart(): void {
  dispatchGuest({ type: 'clear' })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useGuestCart(): GuestCart {
  return useSyncExternalStore(subscribe, getGuestCart)
}
