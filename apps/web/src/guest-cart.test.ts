import { afterEach, expect, test, vi } from 'vitest'
import { cartReducer, cartView, emptyCart, mergeBodies, type CartProduct, type GuestCart } from './guest-cart'

const storeA = '00000000-0000-0000-0000-000000000401'
const storeB = '00000000-0000-0000-0000-000000000402'
const key = 'shopperstop:cart'

function p(overrides: Partial<CartProduct> = {}): CartProduct {
  return {
    id: 'p-taaza',
    name: 'Amul Taaza',
    slug: 'amul-taaza',
    unitLabel: '500 ml',
    priceCents: 2700,
    mrpCents: 2800,
    inStock: true,
    quantity: 10,
    ...overrides,
  }
}

function set(cart: GuestCart, storeId: string, product: CartProduct, quantity: number): GuestCart {
  return cartReducer(cart, { type: 'set', storeId, product, quantity })
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.resetModules()
})

test('guest line set and removed', () => {
  const taaza = p()
  const butter = p({ id: 'p-butter', name: 'Amul Butter', priceCents: 5600 })
  let cart = set(emptyCart, storeA, taaza, 1)
  cart = set(cart, storeA, taaza, 3)
  cart = set(cart, storeA, butter, 1)
  cart = set(cart, storeA, taaza, 0)
  expect(cart.storeId).toBe(storeA)
  expect(cart.items).toEqual([{ product: butter, quantity: 1 }])
  cart = set(cart, storeA, butter, 0)
  expect(cart.storeId).toBeUndefined()
  expect(cart.items).toEqual([])
})

test('guest line clamped', () => {
  const taaza = p({ quantity: 4 })
  const large = p({ id: 'p-large', quantity: 30 })
  const out = p({ id: 'p-out', inStock: false, quantity: 0 })
  let cart = set(emptyCart, storeA, taaza, 6)
  expect(cart.items).toEqual([{ product: taaza, quantity: 4 }])
  cart = set(cart, storeA, large, 25)
  expect(cart.items[1]).toEqual({ product: large, quantity: 20 })
  cart = set(cart, storeA, out, 1)
  expect(cart.items.map((line) => line.product.id)).toEqual(['p-taaza', 'p-large'])
})

test('another store replaces the guest cart', () => {
  const taaza = p()
  const curd = p({ id: 'p-curd', name: 'Nandini Curd', priceCents: 3200 })
  const bread = p({ id: 'p-bread', name: 'Harvest Bread', priceCents: 4000 })
  let cart = set(emptyCart, storeA, taaza, 1)
  cart = set(cart, storeA, curd, 1)
  const stillA = set(cart, storeB, bread, 0)
  expect(stillA).toBe(cart)
  expect(stillA.storeId).toBe(storeA)
  expect(stillA.items.map((line) => line.product.id)).toEqual(['p-taaza', 'p-curd'])
  const atB = set(stillA, storeB, bread, 1)
  expect(atB.storeId).toBe(storeB)
  expect(atB.items).toEqual([{ product: bread, quantity: 1 }])
})

test('guest cart persisted and restored', async () => {
  const first = await import('./guest-cart')
  first.dispatchGuest({ type: 'set', storeId: storeA, product: p(), quantity: 2 })
  const stored = JSON.parse(localStorage.getItem(key) ?? 'null')
  expect(stored.storeId).toBe(storeA)
  expect(stored.items).toHaveLength(1)
  expect(stored.items[0].product.id).toBe('p-taaza')
  expect(stored.items[0].quantity).toBe(2)

  vi.resetModules()
  const second = await import('./guest-cart')
  expect(second.getGuestCart()).toEqual({ storeId: storeA, items: [{ product: p(), quantity: 2 }] })

  localStorage.setItem(key, '{"items":5}')
  vi.resetModules()
  const third = await import('./guest-cart')
  expect(third.getGuestCart()).toEqual({ items: [] })
})

test('guest cart with blocked storage', async () => {
  const blocked = () => {
    throw new DOMException('storage blocked', 'SecurityError')
  }
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)

  const { dispatchGuest, getGuestCart } = await import('./guest-cart')
  dispatchGuest({ type: 'set', storeId: storeA, product: p(), quantity: 1 })
  expect(getGuestCart()).toEqual({ storeId: storeA, items: [{ product: p(), quantity: 1 }] })
})

test("guest totals follow the store's fees", () => {
  const fees = { deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900 }
  const bread = p({ id: 'p-bread', name: 'Harvest Bread', priceCents: 4500 })
  const two = set(emptyCart, storeA, bread, 2)
  expect(cartView(two, fees)).toMatchObject({
    subtotalCents: 9000,
    deliveryFeeCents: 2500,
    totalCents: 11500,
    minOrderCents: 9900,
    shortfallCents: 10900,
  })
  const five = set(emptyCart, storeA, bread, 5)
  expect(cartView(five, fees)).toMatchObject({
    subtotalCents: 22500,
    deliveryFeeCents: 0,
    totalCents: 22500,
    shortfallCents: 0,
  })
  expect(cartView(emptyCart, fees)).toMatchObject({
    subtotalCents: 0,
    deliveryFeeCents: 0,
    totalCents: 0,
    minOrderCents: 0,
    shortfallCents: 0,
  })
})

test('merge bodies in guest order', () => {
  const pp = p({ id: 'p-first' })
  const qq = p({ id: 'p-second', priceCents: 900 })
  let cart = set(emptyCart, storeA, pp, 2)
  cart = set(cart, storeA, qq, 1)
  expect(mergeBodies(cart)).toEqual([
    { storeId: storeA, productId: 'p-first', quantity: 2 },
    { storeId: storeA, productId: 'p-second', quantity: 1 },
  ])
  expect(mergeBodies(emptyCart)).toEqual([])
})
