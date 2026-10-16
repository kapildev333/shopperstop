import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { queryClient } from './api'
import { clearCart, getCartSummary, setQuantity } from './cart'
import { apiError, fakeCore, json } from './fake-core'
import { closePincodeSheet, getPincode, openPincodeSheet, pincodeKey, setPincode } from './pincode'
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

// Core answers by pincode: 560034 and 560095 are Koramangala's, 560038 is Indiranagar's, every other pincode is not served.
function serviceability() {
  return fakeCore({
    'GET /serviceability': (request) => {
      const pincode = new URL(request.url).searchParams.get('pincode') ?? ''
      const store = { '560034': koramangala, '560095': koramangala, '560038': indiranagar }[pincode]
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

test('only digits, six at most', async () => {
  serviceability()
  await openSheet()
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '56a00349')
  expect(screen.getByLabelText('Pincode')).toHaveProp('value', '560034')
  expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
})

test('invalid pincode refused', async () => {
  serviceability()
  await openSheet()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '012345')
  expect(screen.getByText('That is not a valid pincode.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(await AsyncStorage.getItem(pincodeKey)).toBeNull()
})

test('pincode saved from the sheet', async () => {
  serviceability()
  await openSheet()
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '560034')
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
  await waitFor(() => expect(screen.queryByText('Where should we deliver?')).toBeNull())
  expect(getPincode()).toBe('560034')
  expect(await AsyncStorage.getItem(pincodeKey)).toBe('560034')
})

test('saved address fills the pincode', async () => {
  setToken('token')
  fakeCore({
    'GET /serviceability': (request) => {
      const pincode = new URL(request.url).searchParams.get('pincode')
      return pincode === '560038' ? json(200, { store: indiranagar }) : apiError(404, 'not_serviceable')
    },
    'GET /me/addresses': () =>
      json(200, {
        items: [{ id: 'a-1', label: 'Work', line1: '1 Park St', pincode: '560038', isDefault: false }],
      }),
  })
  await openSheet()
  await fireEvent.press(await screen.findByRole('button', { name: 'Work · 560038' }))
  expect(screen.getByLabelText('Pincode')).toHaveProp('value', '560038')
  expect(screen.queryByText(/Have an account\?/)).toBeNull()
})

test('same store or empty cart', async () => {
  serviceability()
  setPincode('560034')
  await resolvePincode('560034')
  setQuantity('s-1', cartProduct, 1)
  await openSheet()
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '560095')
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
  await waitFor(() => expect(getPincode()).toBe('560095'))
  expect(screen.queryByText(/^Switch to the/)).toBeNull()

  await clearCart()
  await act(async () => {
    openPincodeSheet()
  })
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '560038')
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
  await waitFor(() => expect(getPincode()).toBe('560038'))
  expect(screen.queryByText(/^Switch to the/)).toBeNull()
})

// The cart counts 2 at Koramangala; 560038 is Indiranagar's, so the confirm dialog opens.
async function continueToOtherStore() {
  serviceability()
  setPincode('560034')
  await resolvePincode('560034')
  setQuantity('s-1', cartProduct, 2)
  await openSheet()
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '560038')
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
  return screen.findByRole('heading', { name: 'Switch to the Indiranagar store?' })
}

test('store change confirmed', async () => {
  await continueToOtherStore()
  expect(screen.getByText(/Your cart has 2 items from Koramangala/)).toBeTruthy()
  expect(screen.getAllByText(/^(Keep cart|Switch store)$/).map((text) => text.props.children)).toEqual(['Keep cart', 'Switch store'])
  await fireEvent.press(screen.getByRole('button', { name: 'Switch store' }))
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Switch to the Indiranagar store?' })).toBeNull())
  expect(getCartSummary().count).toBe(0)
  expect(getPincode()).toBe('560038')
  await waitFor(async () => expect(await AsyncStorage.getItem(pincodeKey)).toBe('560038'))
})

test('store change kept', async () => {
  await continueToOtherStore()
  await fireEvent.press(screen.getByRole('button', { name: 'Keep cart' }))
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Switch to the Indiranagar store?' })).toBeNull())
  expect(getPincode()).toBe('560034')
  expect(getCartSummary().count).toBe(2)
})

// A lookup that waits until the test releases it, so the sheet can be closed or submitted while it is pending.
function gatedServiceability() {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const calls = fakeCore({
    'GET /serviceability': async (request) => {
      await gate
      const pincode = new URL(request.url).searchParams.get('pincode') ?? ''
      const store = { '560034': koramangala, '560038': indiranagar }[pincode]
      return store ? json(200, { store }) : apiError(404, 'not_serviceable')
    },
  })
  const lookups = () => calls.filter((request) => request.url.includes('/serviceability'))
  // Lets the sheet's continuation run after the lookup answers.
  async function answer() {
    await act(async () => {
      release()
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
  return { lookups, answer }
}

test('dismissed during the lookup saves nothing', async () => {
  const lookup = gatedServiceability()
  await openSheet()
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '560038')
  // The press resolves only when the lookup does, so it is awaited after the answer.
  const pressed = fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
  await waitFor(() => expect(lookup.lookups()).toHaveLength(1))
  await act(async () => {
    closePincodeSheet()
  })
  await lookup.answer()
  await pressed
  expect(getPincode()).toBeUndefined()
  expect(await AsyncStorage.getItem(pincodeKey)).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Switch to the Indiranagar store?' })).toBeNull()
})

test('a second submit while the lookup is pending makes no second lookup', async () => {
  const lookup = gatedServiceability()
  await openSheet()
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '560034')
  const pressed = fireEvent(screen.getByLabelText('Pincode'), 'submitEditing')
  await waitFor(() => expect(lookup.lookups()).toHaveLength(1))
  // The guarded second submit returns nothing to wait for.
  await fireEvent(screen.getByLabelText('Pincode'), 'submitEditing')
  await lookup.answer()
  await pressed
  expect(lookup.lookups()).toHaveLength(1)
  expect(getPincode()).toBe('560034')
})
