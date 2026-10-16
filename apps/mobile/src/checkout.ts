import { formatInr } from '@shopperstop/ui/format'
import { api, call, queryClient, type ApiError } from './api'
import { cartKey, queued, type CartProduct, type CartView } from './cart'
import { cartView, emptyCart } from './cart-guest'
import { getToken } from './session'
import { ordersKey, orderKey, type Order, type OrderResult } from './orders'

export type Refusal = { message: string; detail?: string; addressId?: string; unconfirmed?: true }
export type Outcome = { to: string } | { refusal: Refusal; productIds?: string[] }

// One POST /orders. A placement is done only when the answer holds the order.
export async function postOrder(addressId: string): Promise<OrderResult> {
  const answered: { order?: Order } = {}
  const error = await call(async () => {
    const result = await api.POST('/orders', { body: { addressId } })
    answered.order = result.data
    return result
  })
  if (error) return { error }
  if (!answered.order) return { error: { code: 'internal', message: 'Core answered without an order.' } }
  return { order: answered.order }
}

// The cart is empty: a second press after a placement the page did not see. Matched on the code and the absent field, never the message.
export const cartEmptied = (error: ApiError) => error.code === 'validation' && !error.field

// Runs inside the cart's write queue, so a Stepper tap before the press is placed too.
export function placeOrder(addressId: string, send = postOrder): Promise<OrderResult> {
  const token = getToken()
  if (!token) return Promise.resolve({ error: { code: 'unauthorized', message: 'sign in required' } })
  return queued(async () => {
    if (getToken() !== token) return { error: { code: 'unauthorized', message: 'sign in required' } }
    let result = await send(addressId)
    // An order-number collision is rare: one more try, then the page shows the failure.
    if (result.error?.code === 'conflict') result = await send(addressId)
    const { order, error } = result
    if (order || (error && cartEmptied(error))) {
      await queryClient.cancelQueries({ queryKey: cartKey(token) })
      // Core emptied the cart in the same transaction: the cache is set, not invalidated, so the bar drops its count at once.
      queryClient.setQueryData<CartView>(cartKey(token), cartView(emptyCart))
      if (order) queryClient.setQueryData(orderKey(token, order.id), order)
      void queryClient.invalidateQueries({ queryKey: ordersKey(token) })
    } else if (error?.field === 'addressId' && error.code === 'validation') {
      void queryClient.invalidateQueries({ queryKey: ['addresses'] })
    } else if (error?.code !== 'not_serviceable') {
      // out_of_stock, subtotal, internal: the lines as they are now. internal may still have placed the order (design Decision 21).
      await queryClient.invalidateQueries({ queryKey: cartKey(token) })
    }
    return result
  })
}

// What the customer reads for a refusal. Core's own messages are lower-case API text and are never shown.
export function refusalOf(error: ApiError | undefined, storeName: string, addressId: string): Refusal {
  if (error?.code === 'out_of_stock')
    return {
      message: 'Some products are not available in the quantity you chose.',
      detail: 'Remove them to place your order.',
    }
  if (error?.code === 'not_serviceable') {
    return error.field === 'addressId'
      ? { message: `${storeName} does not deliver to this address. Choose another address or add one.`, addressId }
      : { message: `${storeName} is closed right now.` }
  }
  if (error?.field === 'subtotal') return { message: "Your cart is below the store's minimum order." }
  // The request may have reached core and committed (design Context): never say it failed.
  if (error?.code === 'internal')
    return {
      message: 'We could not confirm your order. It may have been placed, so check Your orders before you place it again.',
      unconfirmed: true,
    }
  return { message: 'Could not place your order. Try again.' }
}

// Where a placement's answer sends the screen: the order, the orders tab, or a refusal with the marks core named.
export function outcomeOf(result: OrderResult, cartAfter: CartView | undefined, storeName: string, addressId: string): Outcome {
  if (result.order) return { to: `/orders/${result.order.id}` }
  const { error } = result
  if (error && cartEmptied(error)) return { to: '/orders' }
  if (error?.code === 'internal' && cartAfter?.items.length === 0) return { to: '/orders' }
  return {
    refusal: refusalOf(error, storeName, addressId),
    productIds: error?.code === 'out_of_stock' ? (error.productIds ?? []) : undefined,
  }
}

// Why a marked line is marked: out of stock, or short of the quantity asked for.
export function shortText(product: CartProduct, quantity: number): string {
  if (!product.inStock) return 'Out of stock'
  if (product.quantity < quantity) return `Only ${product.quantity} left`
  return 'Not enough stock'
}

// Why the order cannot be placed yet, in the bar's precedence: marked lines, then the minimum, then the address.
export function blockReason(input: { marked: boolean; subtotalCents: number; minOrderCents: number; hasAddress: boolean }): string | undefined {
  if (input.marked) return 'Remove the marked products to continue.'
  if (input.subtotalCents < input.minOrderCents)
    return `Minimum order is ${formatInr(input.minOrderCents)}. Add ${formatInr(input.minOrderCents - input.subtotalCents)} more to place the order.`
  if (!input.hasAddress) return 'Add an address to place the order.'
  return undefined
}
