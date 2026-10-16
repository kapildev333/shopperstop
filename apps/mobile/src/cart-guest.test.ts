import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  cartReducer,
  cartView,
  emptyCart,
  itemCount,
  mergeBodies,
  mrpTotalCents,
  type CartLine,
  type CartProduct,
  type GuestCart,
} from './cart-guest'

const storeA = '00000000-0000-4000-8000-000000000401'
const storeB = '00000000-0000-4000-8000-000000000402'
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
  jest.restoreAllMocks()
})

// The guest store is module state and its one read starts from a call, so a storage scenario needs a fresh module graph.
// The module and the storage mock are loaded in one graph so that they share one storage instance.
// The `pure` entry is used because the default entry registers an afterEach, which Jest refuses inside a test.
function loadFresh() {
  let fresh!: { guest: typeof import('./cart-guest'); storage: typeof AsyncStorage }
  jest.isolateModules(() => {
    fresh = {
      guest: jest.requireActual<typeof import('./cart-guest')>('./cart-guest'),
      // The module's own import of the storage, which the setup mocks.
      storage: jest.requireMock<typeof AsyncStorage>('@react-native-async-storage/async-storage'),
    }
  })
  return fresh
}

// Lets the storage mock's writes settle; persistence is fire-and-forget.
function flush() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}

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

test('out of stock at another store keeps the guest cart', () => {
  const taaza = p()
  const curd = p({ id: 'p-curd', name: 'Nandini Curd', priceCents: 3200 })
  const out = p({ id: 'p-out', name: 'Old Stock Ghee', inStock: false, quantity: 0 })
  let cart = set(emptyCart, storeA, taaza, 1)
  cart = set(cart, storeA, curd, 1)
  const after = set(cart, storeB, out, 1)
  expect(after).toBe(cart)
  expect(after.storeId).toBe(storeA)
  expect(after.items.map((line) => line.product.id)).toEqual(['p-taaza', 'p-curd'])
})

test('guest totals follow the store\'s fees', () => {
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

test('guest cart persisted and restored', async () => {
  const first = loadFresh()
  first.guest.dispatchGuest({ type: 'set', storeId: storeA, product: p(), quantity: 2 })
  await flush()
  const stored = JSON.parse(String(await first.storage.getItem(key)))
  expect(stored.storeId).toBe(storeA)
  expect(stored.items).toHaveLength(1)
  expect(stored.items[0].product.id).toBe('p-taaza')
  expect(stored.items[0].quantity).toBe(2)

  const second = loadFresh()
  await second.storage.setItem(key, JSON.stringify(stored))
  await expect(second.guest.loadGuestCart()).resolves.toEqual({ storeId: storeA, items: [{ product: p(), quantity: 2 }] })
  expect(second.guest.getGuestCart()).toEqual({ storeId: storeA, items: [{ product: p(), quantity: 2 }] })

  const third = loadFresh()
  await third.storage.setItem(key, '{"items":5}')
  await expect(third.guest.loadGuestCart()).resolves.toEqual({ items: [] })
  expect(third.guest.getGuestCart()).toEqual({ items: [] })
})

test('guest change wins over a late read', async () => {
  const { guest, storage } = loadFresh()
  let answer!: (value: string | null) => void
  const pending = new Promise<string | null>((resolve) => {
    answer = resolve
  })
  jest.spyOn(storage, 'getItem').mockReturnValueOnce(pending)

  const read = guest.loadGuestCart()
  const curd = p({ id: 'p-curd', name: 'Nandini Curd', priceCents: 3200 })
  guest.dispatchGuest({ type: 'set', storeId: storeA, product: curd, quantity: 1 })
  answer(JSON.stringify({ storeId: storeA, items: [{ product: p(), quantity: 1 }] }))

  const expected = { storeId: storeA, items: [{ product: curd, quantity: 1 }] }
  await expect(read).resolves.toEqual(expected)
  expect(guest.getGuestCart()).toEqual(expected)
  await flush()
  expect(JSON.parse(String(await storage.getItem(key)))).toEqual(expected)
})

test('guest cart with blocked storage', async () => {
  const { guest, storage } = loadFresh()
  const blocked = new Error('storage blocked')
  jest.spyOn(storage, 'getItem').mockRejectedValue(blocked)
  jest.spyOn(storage, 'setItem').mockRejectedValue(blocked)
  jest.spyOn(storage, 'removeItem').mockRejectedValue(blocked)

  await expect(guest.loadGuestCart()).resolves.toEqual({ items: [] })
  guest.dispatchGuest({ type: 'set', storeId: storeA, product: p(), quantity: 1 })
  await flush()
  expect(guest.getGuestCart()).toEqual({ storeId: storeA, items: [{ product: p(), quantity: 1 }] })
})

test('mergeBodies keeps guest order', () => {
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

test('itemCount and mrpTotalCents', () => {
  const lines: CartLine[] = [
    { product: p({ priceCents: 2700, mrpCents: 2800 }), quantity: 2 },
    { product: p({ id: 'p-butter', priceCents: 5600, mrpCents: 5800 }), quantity: 1 },
  ]
  expect(itemCount(lines)).toBe(3)
  expect(mrpTotalCents(lines)).toBe(2800 * 2 + 5800)
  expect(itemCount([])).toBe(0)
  expect(mrpTotalCents([])).toBe(0)
})
