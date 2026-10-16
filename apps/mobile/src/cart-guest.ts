import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useSyncExternalStore } from 'react'

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
  replaced?: boolean
  replacedStoreId?: string
}
export type CartAction = { type: 'set'; storeId: string; product: CartProduct; quantity: number } | { type: 'clear' }

export const guestCartKey = 'shopperstop:cart'
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

// What the store would have charged without its discount: the strike-through total in the cart sheet.
export function mrpTotalCents(items: CartLine[]): number {
  return items.reduce((sum, line) => sum + line.product.mrpCents * line.quantity, 0)
}

export function itemCount(items: CartLine[]): number {
  return items.reduce((sum, line) => sum + line.quantity, 0)
}

export function mergeBodies(cart: GuestCart): { storeId: string; productId: string; quantity: number }[] {
  const { storeId } = cart
  if (!storeId) return []
  return cart.items.map((line) => ({ storeId, productId: line.product.id, quantity: line.quantity }))
}

const listeners = new Set<() => void>()
// Replaced, never mutated: useSyncExternalStore compares snapshots by identity.
let cart: GuestCart = emptyCart
// A change made before the one read settles wins over it; the read's result is then dropped.
let loaded = false
let loading: Promise<void> | undefined

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

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

// Storage can be blocked or fail (privacy modes, full disk); the cart then lives in memory only. The read never rejects.
async function read(): Promise<GuestCart> {
  try {
    return parse(JSON.parse((await AsyncStorage.getItem(guestCartKey)) ?? 'null'))
  } catch {
    return emptyCart
  }
}

// The async function never rejects outward.
async function persist(next: GuestCart) {
  try {
    if (next.items.length > 0) await AsyncStorage.setItem(guestCartKey, JSON.stringify(next))
    else await AsyncStorage.removeItem(guestCartKey)
  } catch {
    // Not persisted; the in-memory cart above still applies for this session.
  }
}

// One read per app run. Its result is dropped when a change beat it; every later call resolves the live cart.
export function loadGuestCart(): Promise<GuestCart> {
  if (!loading) {
    loading = read().then((stored) => {
      if (!loaded) {
        cart = stored
        loaded = true
        emit()
      }
    })
  }
  return loading.then(() => cart)
}

export function getGuestCart(): GuestCart {
  return cart
}

export function dispatchGuest(action: CartAction): void {
  const next = cartReducer(cart, action)
  // A no-op leaves the stored cart for the read to load; the read is only beaten by a real change.
  if (next === cart) return
  cart = next
  loaded = true
  emit()
  void persist(next)
}

// Always wins over a read still pending, even when the cart in memory is already empty (no change to dispatch).
export function clearGuestCart(): void {
  cart = emptyCart
  loaded = true
  emit()
  void persist(emptyCart)
}

// Server snapshot is not yet known: the static export renders in Node, where storage is not read.
export function useGuestCart(): GuestCart {
  const current = useSyncExternalStore(subscribe, getGuestCart, () => emptyCart)
  useEffect(() => {
    void loadGuestCart()
  }, [])
  return current
}
