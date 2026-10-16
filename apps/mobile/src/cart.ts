import { queryOptions, useQuery } from '@tanstack/react-query'
import { useState, useSyncExternalStore } from 'react'
import type { components } from '@shopperstop/ui/api'
import { api, call, queryClient, unreachable, type ApiError } from './api'
import {
  cartView,
  clearGuestCart,
  dispatchGuest,
  emptyCart,
  getGuestCart,
  itemCount,
  loadGuestCart,
  mergeBodies,
  useGuestCart,
  type CartFees,
  type CartProduct,
  type CartView,
} from './cart-guest'
import { getPincode } from './pincode'
import { useStore, type Store, type StoreState } from './serviceability'
import { getToken, useToken } from './session'

export type { CartProduct, CartView } from './cart-guest'

type CartUpdate = components['schemas']['CartUpdate']

export type CartSummary = { count: number; storeId?: string; totalCents: number }

export const cartKey = (token: string) => ['cart', token] as const

// ponytail: a server cart is trusted for a minute between changes; a change or a reload asks core again.
export function cartOptions(token: string) {
  return queryOptions({
    queryKey: cartKey(token),
    staleTime: 60_000,
    queryFn: async (): Promise<CartView> => {
      const { data, error } = await api.GET('/me/cart')
      if (error) throw error.error
      return data
    },
  })
}

// The store whose fees price the guest cart: the resolved store while it is open or closed.
function storeOf(state: StoreState): Store | undefined {
  return state.kind === 'open' || state.kind === 'closed' ? state.store : undefined
}

// The fees of the pincode's store as the cache holds them: the sync summary cannot call useStore().
function cachedFees(): CartFees | undefined {
  return queryClient.getQueryData<{ store?: Store }>(['serviceability', getPincode()])?.store
}

// The cart shown: core's server cart while a token is held, else the guest cart priced at the resolved store.
export function useCart() {
  const token = useToken()
  const guest = useGuestCart()
  const fees = storeOf(useStore())
  const server = useQuery({ ...cartOptions(token ?? ''), enabled: !!token })
  if (!token) {
    return { view: cartView(guest, fees), isPending: false, isError: false, error: undefined, refetch: () => {}, signedIn: false }
  }
  return {
    view: server.data,
    isPending: server.isPending,
    isError: server.isError,
    error: server.error,
    refetch: () => void server.refetch(),
    signedIn: true,
  }
}

// The last quantity asked for each line while its write is queued or in flight, keyed `${storeId}:${productId}`.
const asked = new Map<string, { quantity: number; turn: number }>()
// ponytail: asked survives sign-out until its write settles; clear it in signOut if that window ever shows.
let turn = 0
const askedListeners = new Set<() => void>()

function publishAsked() {
  askedListeners.forEach((listener) => listener())
}

function subscribeAsked(listener: () => void) {
  askedListeners.add(listener)
  return () => {
    askedListeners.delete(listener)
  }
}

const lineKey = (storeId: string, productId: string) => `${storeId}:${productId}`

function useAsked(storeId: string | undefined, productId: string): number | undefined {
  return useSyncExternalStore(subscribeAsked, () => (storeId ? asked.get(lineKey(storeId, productId))?.quantity : undefined))
}

// ponytail: one chain for all carts, per-token chains if two sessions ever coexist.
let chain: Promise<unknown> = Promise.resolve()

// Every server write runs after the one before it settled, so answers land in the order they were asked for.
export function queued<T>(work: () => Promise<T>): Promise<T> {
  const run = chain.then(work)
  chain = run.catch(() => {})
  return run
}

// The count a Stepper shows: the last ask while a write is pending, else the cart's line at the resolved store.
// Product ids are the same at every store: a cart at another store counts for nothing here.
export function useQuantity(productId: string): number {
  const storeId = storeOf(useStore())?.id
  const { view } = useCart()
  const pending = useAsked(storeId, productId)
  const here = !!storeId && view?.storeId === storeId
  const cached = here ? (view?.items.find((line) => line.product.id === productId)?.quantity ?? 0) : 0
  return pending ?? cached
}

// The count a sheet line shows: its own cart line, or the last ask while its write is pending. Unlike useQuantity, it reads the line's store, not the resolved one.
export function useLineQuantity(storeId: string | undefined, productId: string, fallback: number): number {
  return useAsked(storeId, productId) ?? fallback
}

// The last failed write made from this control; it goes when the control is used again or unmounts.
export function useLineWrite(storeId: string | undefined, product: CartProduct) {
  const [failure, setFailure] = useState<string>()
  const write = (quantity: number) => {
    if (!storeId) return
    setFailure(undefined)
    void setQuantity(storeId, product, quantity).then((error) => setFailure(error?.message))
  }
  return [failure, write] as const
}

// Shows the asked count at once; caches core's whole answer when it lands: its items and storeId are the truth, whatever was sent.
export async function setQuantity(storeId: string, product: CartProduct, quantity: number): Promise<ApiError | undefined> {
  const token = getToken()
  if (!token) {
    dispatchGuest({ type: 'set', storeId, product, quantity })
    return undefined
  }
  const key = lineKey(storeId, product.id)
  const mine = ++turn
  asked.set(key, { quantity, turn: mine })
  publishAsked()
  return queued(async () => {
    try {
      // A later tap on this line overtook this write, or the session changed while it waited: skip it.
      if (asked.get(key)?.turn !== mine || getToken() !== token) return
      const previous = queryClient.getQueryData<CartView>(cartKey(token))?.storeId
      const answered: { cart?: CartUpdate } = {}
      const error = await call(async () => {
        const result = await api.PUT('/me/cart/items', { body: { storeId, productId: product.id, quantity } })
        answered.cart = result.data
        return result
      })
      if (!answered.cart) {
        // The cart is re-read behind the answer: the failure does not wait for the re-read.
        void queryClient.invalidateQueries({ queryKey: cartKey(token) })
        // A later tap on this line overtook this write: that one answers for the line.
        return asked.get(key)?.turn === mine ? (error ?? unreachable) : undefined
      }
      await queryClient.cancelQueries({ queryKey: cartKey(token) })
      const { cart } = answered
      queryClient.setQueryData(cartKey(token), cart.replaced ? { ...cart, replacedStoreId: previous } : cart)
      return undefined
    } finally {
      if (asked.get(key)?.turn === mine) {
        asked.delete(key)
        publishAsked()
      }
    }
  })
}

// Empties the cart: the guest cart locally, else core's cart, which is emptied only when core answers.
export async function clearCart(): Promise<ApiError | undefined> {
  const token = getToken()
  if (!token) {
    clearGuestCart()
    return undefined
  }
  return queued(async () => {
    // The session changed while this waited: the DELETE would reach the new session's cart.
    if (getToken() !== token) return undefined
    const error = await call(() => api.DELETE('/me/cart'))
    if (!error) {
      await queryClient.cancelQueries({ queryKey: cartKey(token) })
      queryClient.setQueryData(cartKey(token), cartView(emptyCart))
    }
    return error
  })
}

// Pushes each guest line in guest order, then empties the guest cart even when a push failed. A session change before its turn sends nothing and keeps the guest cart.
export async function mergeGuestCart(): Promise<void> {
  const token = getToken()
  if (!token) return
  // A guest cart still being read is merged too.
  await loadGuestCart()
  return queued(async () => {
    if (getToken() !== token) return
    const bodies = mergeBodies(getGuestCart())
    if (bodies.length === 0) return
    const before = await queryClient.fetchQuery(cartOptions(token)).catch(() => undefined)
    let failed = false
    let clamped = false
    let replaced = false
    let last: CartUpdate | undefined
    for (const body of bodies) {
      const answered: { cart?: CartUpdate } = {}
      const error = await call(async () => {
        const result = await api.PUT('/me/cart/items', { body })
        answered.cart = result.data
        return result
      })
      if (error || !answered.cart) {
        failed = true
        continue
      }
      last = answered.cart
      clamped ||= last.clamped
      replaced ||= last.replaced
    }
    clearGuestCart()
    await queryClient.cancelQueries({ queryKey: cartKey(token) })
    if (last && !failed) {
      queryClient.setQueryData(cartKey(token), {
        ...last,
        clamped,
        replaced,
        ...(replaced ? { replacedStoreId: before?.storeId } : {}),
      })
    } else {
      await queryClient.invalidateQueries({ queryKey: cartKey(token) })
    }
  })
}

function summarize(view?: CartView): CartSummary {
  return { count: itemCount(view?.items ?? []), storeId: view?.storeId, totalCents: view?.totalCents ?? 0 }
}

// Synchronous for the pincode sheet: the signed-in cart as cached (count 0 when none is cached), else the guest cart.
export function getCartSummary(): CartSummary {
  const token = getToken()
  if (token) return summarize(queryClient.getQueryData<CartView>(cartKey(token)))
  return summarize(cartView(getGuestCart(), cachedFees()))
}

export function useCartSummary(): CartSummary {
  return summarize(useCart().view)
}

// After the cart's read settles: core's cart (fetched when not cached), else the guest cart. Undefined when core cannot answer.
export async function loadCartSummary(): Promise<CartSummary | undefined> {
  const token = getToken()
  if (!token) return summarize(cartView(await loadGuestCart(), cachedFees()))
  try {
    return summarize(await queryClient.fetchQuery(cartOptions(token)))
  } catch {
    return undefined
  }
}

// The whole store, cached under its id: checkout reads promisedMinutes from it too.
export function storeOptions(storeId: string) {
  return queryOptions({
    queryKey: ['store', storeId],
    queryFn: async (): Promise<Store> => {
      const { data, error } = await api.GET('/stores/{id}', { params: { path: { id: storeId } } })
      if (error) throw error.error
      if (!data) throw unreachable
      return data
    },
  })
}

// The store's name for the replaced notice; no request without an id.
export function useStoreName(storeId: string | undefined): string | undefined {
  return useQuery({ ...storeOptions(storeId ?? ''), enabled: !!storeId, select: (store) => store.name }).data
}

// The cart sheet's open state: one sheet, opened by the bar or a replaced answer, closed by its own controls.
let sheetOpen = false
const sheetListeners = new Set<() => void>()

function emitSheet() {
  sheetListeners.forEach((listener) => listener())
}

function subscribeSheet(listener: () => void) {
  sheetListeners.add(listener)
  return () => {
    sheetListeners.delete(listener)
  }
}

export function openCartSheet(): void {
  sheetOpen = true
  emitSheet()
}

export function closeCartSheet(): void {
  sheetOpen = false
  emitSheet()
}

export function useCartSheetOpen(): boolean {
  return useSyncExternalStore(subscribeSheet, () => sheetOpen, () => false)
}
