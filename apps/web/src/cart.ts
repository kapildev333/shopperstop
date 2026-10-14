import { queryOptions, useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { components } from '@shopperstop/ui/api'
import { api, call, queryClient, type ApiError } from './api'
import { useServiceability, type StoreProduct } from './catalog'
import {
  cartView,
  clearGuestCart,
  dispatchGuest,
  emptyCart,
  getGuestCart,
  mergeBodies,
  useGuestCart,
  type CartProduct,
  type CartView,
} from './guest-cart'
import { usePincode } from './pincode'
import { getToken, useToken } from './session'

type CartUpdate = components['schemas']['CartUpdate']

export const cartKey = (token: string) => ['cart', token] as const

// ponytail: a server cart is trusted for a minute between changes; a change or a reload asks core again.
export function cartOptions(token: string) {
  return queryOptions({
    queryKey: cartKey(token),
    staleTime: 60_000,
    queryFn: async (): Promise<CartView> => {
      const { data, error } = await api.GET('/me/cart')
      if (error) throw error
      return data
    },
  })
}

// The cart shown: core's server cart while a token is held, else the guest cart priced at the resolved store.
export function useCart() {
  const token = useToken()
  const guest = useGuestCart()
  const store = useServiceability(usePincode().pincode).data ?? undefined
  const server = useQuery({ ...cartOptions(token ?? ''), enabled: !!token })
  if (!token) {
    return { view: cartView(guest, store), isPending: false, isError: false, refetch: () => {}, signedIn: false }
  }
  return {
    view: server.data,
    isPending: server.isPending,
    isError: server.isError,
    refetch: () => void server.refetch(),
    signedIn: true,
  }
}

// The last quantity asked for each line while its write is queued or in flight, keyed `${storeId}:${productId}`.
const asked = new Map<string, { quantity: number; turn: number }>()
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

export function useAsked(storeId: string | undefined, productId: string): number | undefined {
  return useSyncExternalStore(subscribeAsked, () => (storeId ? asked.get(lineKey(storeId, productId))?.quantity : undefined))
}

// ponytail: one chain for all carts, per-token chains if two sessions ever coexist.
let chain: Promise<unknown> = Promise.resolve()

// Every server write runs after the one before it settled, so answers land in the order they were asked for.
function queued<T>(work: () => Promise<T>): Promise<T> {
  const run = chain.then(work)
  chain = run.catch(() => {})
  return run
}

// Product ids are the same at every store: a cart at another store counts for nothing here.
export function useCartQuantity(product: StoreProduct) {
  const { view } = useCart()
  const storeId = useServiceability(usePincode().pincode).data?.id
  const pending = useAsked(storeId, product.id)
  const here = !!storeId && view?.storeId === storeId
  const cached = here ? (view?.items.find((line) => line.product.id === product.id)?.quantity ?? 0) : 0
  return [
    pending ?? cached,
    (next: number) => {
      if (storeId) void setLine(storeId, product, next)
    },
  ] as const
}

// Shows the asked count at once; caches core's whole answer when it lands: its items and storeId are the truth, whatever was sent.
export async function setLine(storeId: string, product: CartProduct, quantity: number): Promise<void> {
  const token = getToken()
  if (!token) return dispatchGuest({ type: 'set', storeId, product, quantity })
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
      await call(async () => {
        const result = await api.PUT('/me/cart/items', { body: { storeId, productId: product.id, quantity } })
        answered.cart = result.data
        return result
      })
      if (!answered.cart) {
        await queryClient.invalidateQueries({ queryKey: cartKey(token) })
        return
      }
      await queryClient.cancelQueries({ queryKey: cartKey(token) })
      const { cart } = answered
      queryClient.setQueryData(cartKey(token), cart.replaced ? { ...cart, replacedStoreId: previous } : cart)
    } finally {
      if (asked.get(key)?.turn === mine) {
        asked.delete(key)
        publishAsked()
      }
    }
  })
}

export async function clearCart(): Promise<ApiError | undefined> {
  const token = getToken()
  if (!token) {
    clearGuestCart()
    return undefined
  }
  return queued(async () => {
    const error = await call(() => api.DELETE('/me/cart'))
    if (!error) {
      await queryClient.cancelQueries({ queryKey: cartKey(token) })
      queryClient.setQueryData(cartKey(token), cartView(emptyCart))
    }
    return error
  })
}

// Pushes each guest line in guest order, then empties the guest cart even when a push failed.
export async function mergeGuestCart(): Promise<void> {
  const token = getToken()
  const bodies = mergeBodies(getGuestCart())
  if (!token || bodies.length === 0) return
  return queued(async () => {
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
