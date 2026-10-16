import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import { useState } from 'react'
import { queryClient } from './api'
import { AddressCard } from './checkout-address'
import { fakeCore, json } from './fake-core'
import { setToken } from './session'

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true],
  Inter_400Regular: 'Inter_400Regular',
  Inter_600SemiBold: 'Inter_600SemiBold',
  Inter_700Bold: 'Inter_700Bold',
}))

const home = { id: '00000000-0000-4000-8000-000000000301', label: 'Home', line1: '12 80 Feet Rd', line2: 'Koramangala', pincode: '560034', isDefault: true }
const work = { id: '00000000-0000-4000-8000-000000000302', label: 'Work', line1: '1 Park St', pincode: '560038', isDefault: false }
const added = { id: '00000000-0000-4000-8000-000000000303', label: 'Work', line1: '1 Park St', pincode: '560038', isDefault: false }

function Harness() {
  const [chosen, setChosen] = useState<string>()
  return <AddressCard chosen={chosen} onChoose={setChosen} />
}

async function renderCard(element = <Harness />) {
  setToken('t-1')
  await render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>)
}

// The "Choose address" sheet holds the radio group; its title is a heading.
async function openChoice() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Change address' }))
  return screen.findByRole('radiogroup', { name: 'Deliver to' })
}

test('Default address shown', async () => {
  fakeCore({ 'GET /me/addresses': () => json(200, { items: [work, home], page: 1, pageSize: 24, total: 2 }) })
  await renderCard()

  expect(await screen.findByText('Delivering to Home')).toBeTruthy()
  expect(screen.getByText('12 80 Feet Rd, Koramangala, 560034')).toBeTruthy()
})

test('No address yet', async () => {
  fakeCore({ 'GET /me/addresses': () => json(200, { items: [], page: 1, pageSize: 24, total: 0 }) })
  await renderCard()

  expect(await screen.findByText('No addresses yet')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Add address' })).toBeTruthy()
})

test('Choice sheet lists the addresses', async () => {
  fakeCore({ 'GET /me/addresses': () => json(200, { items: [work, home], page: 1, pageSize: 24, total: 2 }) })
  await renderCard()

  const group = await openChoice()
  expect(within(group).getByRole('radio', { name: 'Deliver to Work' })).not.toBeChecked()
  expect(within(group).getByRole('radio', { name: 'Deliver to Home' })).toBeChecked()
  expect(within(group).getByText('Default')).toBeTruthy()
})

test('Another address chosen', async () => {
  fakeCore({ 'GET /me/addresses': () => json(200, { items: [work, home], page: 1, pageSize: 24, total: 2 }) })
  await renderCard()

  const group = await openChoice()
  await fireEvent.press(within(group).getByRole('radio', { name: 'Deliver to Work' }))

  await waitFor(() => expect(screen.queryByRole('radiogroup', { name: 'Deliver to' })).toBeNull())
  expect(await screen.findByText('Delivering to Work')).toBeTruthy()
})

test('Address added at checkout', async () => {
  let saved = false
  const calls = fakeCore({
    'GET /me/addresses': () =>
      saved
        ? json(200, { items: [work, home], page: 1, pageSize: 24, total: 2 })
        : json(200, { items: [home], page: 1, pageSize: 24, total: 1 }),
    'POST /me/addresses': () => {
      saved = true
      return json(201, added)
    },
  })
  await renderCard()

  const group = await openChoice()
  expect(within(group).getByRole('radio', { name: 'Deliver to Home' })).toBeChecked()
  await fireEvent.press(within(group).getByRole('button', { name: 'Add address' }))

  // The choice sheet closes before the address sheet opens.
  await waitFor(() => expect(screen.queryByRole('radiogroup', { name: 'Deliver to' })).toBeNull())
  await fireEvent.press(await screen.findByRole('button', { name: 'Work' }))
  await fireEvent.changeText(screen.getByLabelText('House, flat, floor'), '1 Park St')
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '560038')
  await fireEvent.press(screen.getByRole('button', { name: 'Save address' }))

  expect(await screen.findByText('Delivering to Work')).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save address' })).toBeNull())
  expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1)
})

test('refused address badge', async () => {
  fakeCore({ 'GET /me/addresses': () => json(200, { items: [work, home], page: 1, pageSize: 24, total: 2 }) })
  await renderCard(<AddressCard chosen={work.id} refusedId={work.id} onChoose={jest.fn()} />)

  expect(await screen.findByText('Delivering to Work')).toBeTruthy()
  expect(screen.getByText('Not delivered here')).toBeTruthy()

  const group = await openChoice()
  expect(within(group).getByRole('radio', { name: 'Deliver to Work' })).toHaveTextContent('Not delivered here')
  expect(within(group).getByRole('radio', { name: 'Deliver to Home' })).not.toHaveTextContent('Not delivered here')
})
