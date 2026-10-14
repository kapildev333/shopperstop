import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { queryClient } from './api'
import { cartKey } from './cart'
import { keys } from './catalog'
import { cartView, dispatchGuest, getGuestCart, type CartProduct } from './guest-cart'
import { getPincode, openPincodeSheet, setPincode } from './pincode'
import { setToken } from './session'
import { changePincode } from './store-change'
import { product, renderAt, store } from './test-data'

const koramangala = '00000000-0000-4000-8000-000000000401'
const indiranagar = '00000000-0000-4000-8000-000000000402'
const taaza: CartProduct = product()

// 560034 and 560095 are both Koramangala; 560038 is Indiranagar.
function seedStores() {
  setPincode('560034')
  queryClient.setQueryData(keys.serviceability('560034'), store())
  queryClient.setQueryData(keys.serviceability('560095'), store())
  queryClient.setQueryData(keys.serviceability('560038'), store({ id: indiranagar, name: 'Indiranagar', promisedMinutes: 12 }))
}

function guestLine() {
  act(() => dispatchGuest({ type: 'set', storeId: koramangala, product: taaza, quantity: 1 }))
}

test('same store or empty cart', async () => {
  seedStores()
  guestLine()
  renderAt('/')
  // Another pincode of the same store: no dialog, the pincode is stored.
  await act(async () => {
    await changePincode('560095')
  })
  expect(getPincode()).toBe('560095')
  expect(screen.queryByRole('dialog', { name: 'Change store?' })).toBeNull()

  // A store change with an empty cart: stored at once, no dialog.
  act(() => dispatchGuest({ type: 'clear' }))
  await act(async () => {
    await changePincode('560038')
  })
  expect(getPincode()).toBe('560038')
  expect(screen.queryByRole('dialog', { name: 'Change store?' })).toBeNull()
})

test('store change confirmed', async () => {
  seedStores()
  guestLine()
  renderAt('/')
  act(() => openPincodeSheet())
  await act(async () => {
    await changePincode('560038')
  })
  const dialog = await screen.findByRole('dialog', { name: 'Change store?' })
  // The sheet closed before the dialog opened.
  expect(screen.queryByRole('dialog', { name: 'Your delivery pincode' })).toBeNull()
  expect(within(dialog).getByText(/Indiranagar delivers to 560038/)).toBeInTheDocument()
  expect(within(dialog).getAllByRole('button')[0]).toHaveAccessibleName('Cancel')

  await userEvent.click(within(dialog).getByRole('button', { name: 'Empty cart and change' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Change store?' })).toBeNull())
  expect(getGuestCart().items).toEqual([])
  expect(getPincode()).toBe('560038')
  expect(localStorage.getItem('shopperstop:pincode')).toBe('560038')
})

test('store change cancelled', async () => {
  seedStores()
  guestLine()
  renderAt('/')
  await act(async () => {
    await changePincode('560038')
  })
  const dialog = await screen.findByRole('dialog', { name: 'Change store?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel', exact: true }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Change store?' })).toBeNull())
  expect(getPincode()).toBe('560034')
  expect(getGuestCart().items).toHaveLength(1)
})

test('emptying the server cart fails', async () => {
  seedStores()
  setToken('t')
  queryClient.setQueryData(cartKey('t'), cartView({ storeId: koramangala, items: [{ product: taaza, quantity: 1 }] }, store()))
  renderAt('/')
  await act(async () => {
    await changePincode('560038')
  })
  const dialog = await screen.findByRole('dialog', { name: 'Change store?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Empty cart and change' }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not empty your cart.')
  expect(screen.getByRole('dialog', { name: 'Change store?' })).toBeInTheDocument()
  expect(getPincode()).toBe('560034')
})
