import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { queryClient } from './api'
import { cartKey, getCartSummary } from './cart'
import { apiError, fakeCore, json } from './fake-core'
import { getPincode, openPincodeSheet, pincodeKey } from './pincode'
import { PincodeSheet } from './pincode-sheet'
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
const taaza = {
  id: 'p-1',
  name: 'Amul Taaza',
  slug: 'amul-taaza',
  unitLabel: '500 ml',
  mrpCents: 2900,
  priceCents: 2700,
  inStock: true,
  quantity: 5,
}

// The signed-in cart holds 2 Taaza at Koramangala, every field of core's Cart.
const serverCart = {
  storeId: koramangala.id,
  items: [{ product: taaza, quantity: 2 }],
  subtotalCents: 5400,
  deliveryFeeCents: 2500,
  totalCents: 7900,
  minOrderCents: 9900,
  shortfallCents: 14500,
}

// 560034 is Koramangala's, 560038 is Indiranagar's.
function serviceability() {
  return fakeCore({
    'GET /serviceability': (request) => {
      const pincode = new URL(request.url).searchParams.get('pincode') ?? ''
      const store = { '560034': koramangala, '560038': indiranagar }[pincode]
      return store ? json(200, { store }) : apiError(404, 'not_serviceable')
    },
  })
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

// Signed in with the cart at Koramangala; the sheet asks for 560038, so the confirm dialog opens.
async function continueToOtherStore() {
  setToken('t-1')
  queryClient.setQueryData(cartKey('t-1'), serverCart)
  await openSheet()
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '560038')
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
  return screen.findByRole('heading', { name: 'Switch to the Indiranagar store?' })
}

test('server cart emptied on a store change', async () => {
  serviceability()
  await continueToOtherStore()
  const calls = fakeCore({
    'GET /serviceability': () => json(200, { store: indiranagar }),
    'DELETE /me/cart': () => json(204),
  })

  await fireEvent.press(screen.getByRole('button', { name: 'Switch store' }))

  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Switch to the Indiranagar store?' })).toBeNull())
  expect(calls.map((request) => `${request.method} ${new URL(request.url).pathname}`)).toContain('DELETE /api/core/v1/me/cart')
  expect(queryClient.getQueryData(cartKey('t-1'))).toMatchObject({ items: [] })
  expect(getCartSummary().count).toBe(0)
  expect(getPincode()).toBe('560038')
  await waitFor(async () => expect(await AsyncStorage.getItem(pincodeKey)).toBe('560038'))
})

test('emptying the server cart fails', async () => {
  serviceability()
  await continueToOtherStore()
  fakeCore({
    'DELETE /me/cart': () => {
      throw new TypeError('Network request failed')
    },
  })

  await fireEvent.press(screen.getByRole('button', { name: 'Switch store' }))

  expect(await screen.findByText('Could not empty your cart.')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Switch to the Indiranagar store?' })).toBeTruthy()
  expect(getPincode()).toBeUndefined()
  await expect(AsyncStorage.getItem(pincodeKey)).resolves.toBeNull()
  expect(getCartSummary().count).toBe(2)
})
