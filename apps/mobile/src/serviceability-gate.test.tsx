import { QueryClientProvider } from '@tanstack/react-query'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { queryClient } from './api'
import { apiError, fakeCore, json } from './fake-core'
import { setPincode, usePincodeSheetOpen } from './pincode'
import { StoreGate } from './serviceability-gate'

const store = {
  id: '00000000-0000-4000-8000-000000000401',
  name: 'Koramangala',
  isOpen: true,
  deliveryFeeCents: 2500,
  freeDeliveryAboveCents: 19900,
  minOrderCents: 9900,
  promisedMinutes: 10,
}

afterEach(() => {
  jest.restoreAllMocks()
})

function Probe() {
  return <Text>{usePincodeSheetOpen() ? 'sheet open' : 'sheet closed'}</Text>
}

async function renderGate() {
  return render(
    <QueryClientProvider client={queryClient}>
      <StoreGate>{(found) => <Text>open {found.name}</Text>}</StoreGate>
      <Probe />
    </QueryClientProvider>,
  )
}

// First in the file on purpose: the store's one storage read starts at the first render, and only that render sees the pincode unknown.
test('loading while the pincode is unknown', async () => {
  jest.spyOn(AsyncStorage, 'getItem').mockReturnValue(new Promise(() => undefined))

  await renderGate()

  expect(screen.getByLabelText('Loading')).toBeTruthy()
})

test('loading while the lookup has no answer', async () => {
  setPincode('560034')
  fakeCore({ 'GET /serviceability': () => new Promise(() => undefined) })

  await renderGate()

  expect(screen.getByLabelText('Loading')).toBeTruthy()
})

test('not serviceable notice', async () => {
  setPincode('110001')
  fakeCore({
    'GET /serviceability': () => apiError(404, 'not_serviceable', 'we do not deliver to this pincode yet'),
  })

  await renderGate()

  expect(await screen.findByRole('heading', { name: "We don't deliver here yet", level: 2 })).toBeTruthy()
  expect(screen.getByText('sheet closed')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Change pincode' }))
  expect(screen.getByText('sheet open')).toBeTruthy()
})

test('closed store notice', async () => {
  setPincode('560034')
  fakeCore({
    'GET /serviceability': () => json(200, { store: { ...store, isOpen: false } }),
  })

  await renderGate()

  expect(await screen.findByRole('heading', { name: 'Koramangala store is closed', level: 2 })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Change pincode' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'See your orders' })).toBeTruthy()
  expect(screen.queryByText('open Koramangala')).toBeNull()
})

test('store lookup fails', async () => {
  setPincode('560034')
  // No fake core yet: the lookup is refused, as when core cannot be reached.
  await renderGate()

  expect(await screen.findByText("You're offline")).toBeTruthy()

  fakeCore({ 'GET /serviceability': () => json(200, { store }) })
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('open Koramangala')).toBeTruthy()
})

test('no pincode notice', async () => {
  await renderGate()

  expect(await screen.findByRole('heading', { name: 'Set your pincode', level: 2 })).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Choose pincode' }))
  expect(screen.getByText('sheet open')).toBeTruthy()
})
