import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { queryClient } from './api'
import { setQuantity } from './cart'
import { apiError, fakeCore, json } from './fake-core'
import { getPincode, openPincodeSheet, pincodeKey, setPincode } from './pincode'
import { PincodeSheet } from './pincode-sheet'
import { resolvePincode } from './serviceability'
import { setToken } from './session'

const koramangala = {
  id: 's-1',
  name: 'Koramangala',
  isOpen: true,
  deliveryFeeCents: 2500,
  freeDeliveryAboveCents: 19900,
  minOrderCents: 9900,
  promisedMinutes: 10,
}
const indiranagar = { ...koramangala, id: 's-2', name: 'Indiranagar', promisedMinutes: 12 }
const cartProduct = {
  id: 'p-1',
  name: 'Amul Taaza',
  slug: 'amul-taaza',
  unitLabel: '500 ml',
  mrpCents: 2900,
  priceCents: 2700,
  inStock: true,
  quantity: 5,
}

// Core answers by pincode; 560038's lookup throws when `unreachable` is set (the network refuses it).
function serviceability({ unreachable = false }: { unreachable?: boolean } = {}) {
  return fakeCore({
    'GET /serviceability': async (request) => {
      const pincode = new URL(request.url).searchParams.get('pincode') ?? ''
      if (unreachable && pincode === '560038') throw new TypeError('Network request failed')
      const store = { '560034': koramangala, '560038': indiranagar }[pincode]
      return store ? json(200, { store }) : apiError(404, 'not_serviceable')
    },
  })
}

// A server cart of Amul Taaza at Koramangala, every field of core's Cart.
function serverCart() {
  const subtotalCents = cartProduct.priceCents * 2
  return {
    storeId: koramangala.id,
    items: [{ product: cartProduct, quantity: 2 }],
    subtotalCents,
    deliveryFeeCents: 2500,
    totalCents: subtotalCents + 2500,
    minOrderCents: 9900,
    shortfallCents: Math.max(0, 19900 - subtotalCents),
  }
}

async function openSheet() {
  await render(
    <QueryClientProvider client={queryClient}>
      <PincodeSheet />
    </QueryClientProvider>,
  )
  await act(async () => {
    openPincodeSheet()
  })
}

async function continueWith(pincode: string) {
  await fireEvent.changeText(screen.getByLabelText('Pincode'), pincode)
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
}

// Koramangala's cart holds 2 lines of Amul Taaza, with 560034 stored as the pincode.
async function guestCartAtKoramangala() {
  serviceability()
  setPincode('560034')
  await resolvePincode('560034')
  await setQuantity('s-1', cartProduct, 2)
}

test("failed lookup keeps the cart's pincode", async () => {
  await guestCartAtKoramangala()
  serviceability({ unreachable: true })
  await openSheet()
  await continueWith('560038')
  expect(await screen.findByText('Could not check this pincode. Try again.')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Where should we deliver?' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: /^Switch to the/ })).toBeNull()
  expect(getPincode()).toBe('560034')
  expect(await AsyncStorage.getItem(pincodeKey)).toBe('560034')
})

test("unreadable server cart keeps the cart's pincode", async () => {
  setToken('t-1')
  serviceability()
  setPincode('560034')
  await resolvePincode('560034')
  fakeCore({
    'GET /serviceability': async (request) => {
      const pincode = new URL(request.url).searchParams.get('pincode') ?? ''
      const store = { '560034': koramangala, '560038': indiranagar }[pincode]
      return store ? json(200, { store }) : apiError(404, 'not_serviceable')
    },
    'GET /me/cart': () => apiError(500, 'internal', 'Core is down'),
  })
  await openSheet()
  await continueWith('560038')
  expect(await screen.findByText('Could not check this pincode. Try again.')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: /^Switch to the/ })).toBeNull()
  expect(getPincode()).toBe('560034')
})

test('unread server cart is fetched before comparing', async () => {
  setToken('t-1')
  serviceability()
  setPincode('560034')
  await resolvePincode('560034')
  fakeCore({
    'GET /serviceability': async (request) => {
      const pincode = new URL(request.url).searchParams.get('pincode') ?? ''
      const store = { '560034': koramangala, '560038': indiranagar }[pincode]
      return store ? json(200, { store }) : apiError(404, 'not_serviceable')
    },
    'GET /me/cart': () => json(200, serverCart()),
  })
  await openSheet()
  await continueWith('560038')
  expect(await screen.findByRole('heading', { name: 'Switch to the Indiranagar store?' })).toBeTruthy()
  expect(getPincode()).toBe('560034')
})

test('failed lookup with an empty cart', async () => {
  serviceability({ unreachable: true })
  await openSheet()
  await continueWith('560038')
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Where should we deliver?' })).toBeNull())
  expect(getPincode()).toBe('560038')
  expect(await AsyncStorage.getItem(pincodeKey)).toBe('560038')
  expect(screen.queryByText('Could not check this pincode. Try again.')).toBeNull()
})
