import { formatInr } from '@shopperstop/ui/format'
import { queryClient } from './api'
import { cartKey, setQuantity, type CartProduct } from './cart'
import { cartView, emptyCart, type CartView } from './cart-guest'
import { blockReason, outcomeOf, placeOrder, refusalOf, shortText } from './checkout'
import { apiError, fakeCore, json } from './fake-core'
import { orderKey, type Order } from './orders'
import { setToken } from './session'

const storeId = '00000000-0000-4000-8000-000000000401'
const homeId = '00000000-0000-4000-8000-000000000301'
const id = '00000000-0000-4000-8000-000000000901'
const placedAt = '2026-10-16T10:00:00Z'
const taaza: CartProduct = {
  id: '00000000-0000-4000-8000-000000000601',
  name: 'Amul Taaza',
  slug: 'amul-taaza',
  unitLabel: '500 ml',
  mrpCents: 2900,
  priceCents: 2700,
  inStock: true,
  quantity: 5,
}

// Core's cart of two Taaza at the store, every amount of its Cart.
const serverCart = {
  storeId,
  items: [{ product: taaza, quantity: 2 }],
  subtotalCents: 5400,
  deliveryFeeCents: 2500,
  totalCents: 7900,
  minOrderCents: 9900,
  shortfallCents: 4500,
}

// An answered order, as POST /orders returns it.
function order(over: Partial<Order> = {}): Order {
  return {
    id,
    number: 'SS-ABCDEFGH',
    storeId,
    storeName: 'Koramangala',
    promisedMinutes: 10,
    status: 'placed',
    customerName: 'Asha Rao',
    address: { label: 'Home', line1: '12 80 Feet Rd', line2: 'Koramangala', pincode: '560034' },
    subtotalCents: 5400,
    deliveryFeeCents: 2500,
    totalCents: 7900,
    paymentMethod: 'cod',
    placedAt,
    items: [{ productId: taaza.id, name: taaza.name, unitLabel: taaza.unitLabel, priceCents: 2700, mrpCents: 2900, quantity: 2 }],
    events: [{ toStatus: 'placed', actorType: 'customer', createdAt: placedAt }],
    ...over,
  }
}

// The requests fake core saw, as "METHOD /path" under /api/core/v1.
function paths(calls: Request[]) {
  return calls.map((request) => `${request.method} ${new URL(request.url).pathname.replace('/api/core/v1', '')}`)
}

test('Order placed after a pending cart change', async () => {
  setToken('t-1')
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  const calls = fakeCore({
    'PUT /me/cart/items': async () => {
      await held
      return json(200, serverCart)
    },
    'POST /orders': () => json(201, order()),
    'GET /me/cart': () => json(200, serverCart),
  })

  const writing = setQuantity(storeId, taaza, 2)
  const placing = placeOrder(homeId)

  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(paths(calls)).toEqual(['PUT /me/cart/items'])

  release()
  await writing
  const result = await placing

  expect(result.order?.id).toBe(id)
  expect(paths(calls)).toEqual(['PUT /me/cart/items', 'POST /orders'])
  expect(await (calls[1] as Request).json()).toEqual({ addressId: homeId })
})

test('Order number collision retried once', async () => {
  setToken('t-1')
  const answers = [apiError(409, 'conflict'), json(201, order())]
  const calls = fakeCore({ 'POST /orders': () => answers.shift() as Response })

  const retried = await placeOrder(homeId)

  expect(paths(calls)).toEqual(['POST /orders', 'POST /orders'])
  expect(retried.order?.id).toBe(id)

  const again = fakeCore({ 'POST /orders': () => apiError(409, 'conflict') })

  const failed = await placeOrder(homeId)

  expect(paths(again)).toEqual(['POST /orders', 'POST /orders'])
  expect(failed.error?.code).toBe('conflict')
})

test('order held and cart emptied on success', async () => {
  setToken('t-1')
  queryClient.setQueryData(cartKey('t-1'), serverCart)
  fakeCore({ 'POST /orders': () => json(201, order()) })

  await placeOrder(homeId)

  expect(queryClient.getQueryData(orderKey('t-1', id))).toEqual(order())
  expect(queryClient.getQueryData<CartView>(cartKey('t-1'))?.items).toEqual([])
})

test.each<[string, Parameters<typeof outcomeOf>[0], CartView | undefined, unknown]>([
  ['an answered order goes to its tracking screen', { order: order() }, undefined, { to: `/orders/${id}` }],
  [
    'an empty cart with no field goes to orders',
    { error: { code: 'validation', message: 'cart is empty' } },
    undefined,
    { to: '/orders' },
  ],
  [
    'an internal answer after which the cart reads empty goes to orders',
    { error: { code: 'internal', message: 'x' } },
    cartView(emptyCart),
    { to: '/orders' },
  ],
  [
    'an internal answer with the cart still holding lines is unconfirmed',
    { error: { code: 'internal', message: 'x' } },
    cartView({ storeId, items: [{ product: taaza, quantity: 2 }] }),
    {
      refusal: {
        message: 'We could not confirm your order. It may have been placed, so check Your orders before you place it again.',
        unconfirmed: true,
      },
      productIds: undefined,
    },
  ],
  [
    'out of stock keeps the product ids core named',
    { error: { code: 'out_of_stock', message: 'x', productIds: [taaza.id] } },
    undefined,
    {
      refusal: { message: 'Some products are not available in the quantity you chose.' },
      productIds: [taaza.id],
    },
  ],
  [
    'out of stock with no ids names none',
    { error: { code: 'out_of_stock', message: 'x' } },
    undefined,
    { refusal: { message: 'Some products are not available in the quantity you chose.' }, productIds: [] },
  ],
  [
    'an address core does not serve is refused with the address',
    { error: { code: 'not_serviceable', message: 'x', field: 'addressId' } },
    undefined,
    {
      refusal: {
        message: 'Koramangala does not deliver to this address. Choose another address or add one.',
        addressId: homeId,
      },
      productIds: undefined,
    },
  ],
])('outcome of each answer: %s', (_name, result, cartAfter, expected) => {
  expect(outcomeOf(result, cartAfter, 'Koramangala', homeId)).toEqual(expected)
})

test.each<[string, Parameters<typeof refusalOf>[0], unknown]>([
  [
    'out of stock',
    { code: 'out_of_stock', message: 'x' },
    { message: 'Some products are not available in the quantity you chose.' },
  ],
  [
    'not served at the address',
    { code: 'not_serviceable', message: 'x', field: 'addressId' },
    {
      message: 'Koramangala does not deliver to this address. Choose another address or add one.',
      addressId: homeId,
    },
  ],
  ['store closed', { code: 'not_serviceable', message: 'x' }, { message: 'Koramangala is closed right now.' }],
  [
    'below the minimum',
    { code: 'validation', message: 'x', field: 'subtotal' },
    { message: "Your cart is below the store's minimum order." },
  ],
  [
    'internal',
    { code: 'internal', message: 'x' },
    {
      message: 'We could not confirm your order. It may have been placed, so check Your orders before you place it again.',
      unconfirmed: true,
    },
  ],
  ['any other refusal', { code: 'conflict', message: 'x' }, { message: 'Could not place your order. Try again.' }],
  ['no error', undefined, { message: 'Could not place your order. Try again.' }],
])('refusal copy: %s', (_name, error, expected) => {
  expect(refusalOf(error, 'Koramangala', homeId)).toEqual(expected)
})

test('mark text', () => {
  expect(shortText({ ...taaza, inStock: false, quantity: 0 }, 2)).toBe('Out of stock')
  expect(shortText({ ...taaza, quantity: 2 }, 3)).toBe('Only 2 left')
  expect(shortText({ ...taaza, quantity: 5 }, 3)).toBe('Not enough stock')
})

test('block precedence', () => {
  const minimum = `Minimum order is ${formatInr(9900)}. Add ${formatInr(4900)} more to place the order.`
  expect(blockReason({ marked: true, subtotalCents: 0, minOrderCents: 9900, hasAddress: false })).toBe(
    'Remove the marked products to continue.',
  )
  expect(blockReason({ marked: false, subtotalCents: 5000, minOrderCents: 9900, hasAddress: false })).toBe(minimum)
  expect(blockReason({ marked: false, subtotalCents: 10000, minOrderCents: 9900, hasAddress: false })).toBe(
    'Add an address to place the order.',
  )
  expect(blockReason({ marked: false, subtotalCents: 10000, minOrderCents: 9900, hasAddress: true })).toBeUndefined()
})
