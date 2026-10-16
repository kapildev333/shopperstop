import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { queryClient } from './api'
import { apiError, fakeCore, json } from './fake-core'
import type { Order } from './orders'
import { deliveryKey } from './rider'
import { RiderCard } from './rider-card'
import { setToken } from './session'

const delivery = '/api/rider/v1/orders/o-1/delivery'

function order(over: Partial<Order> = {}): Order {
  return {
    id: 'o-1',
    number: 'SS-DEMOAAAD',
    storeId: 'store-1',
    storeName: 'Koramangala',
    promisedMinutes: 10,
    status: 'out_for_delivery',
    customerName: 'Asha',
    address: { label: 'Home', line1: '12 MG Road', pincode: '560034' },
    subtotalCents: 4000,
    deliveryFeeCents: 0,
    totalCents: 4000,
    paymentMethod: 'cod',
    placedAt: new Date().toISOString(),
    items: [],
    events: [],
    ...over,
  }
}

// The root layout provides the query client in the app; the card needs it here too.
function renderCard(card: Order) {
  return render(
    <QueryClientProvider client={queryClient}>
      <RiderCard order={card} />
    </QueryClientProvider>,
  )
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

test('Rider on the way with a position', async () => {
  setToken('t-rider')
  const recordedAt = minutesAgo(3)
  const calls = fakeCore({
    [`GET ${delivery}`]: () => json(200, { riderName: 'Asha', status: 'assigned', location: { lat: 12.9352, lng: 77.6245, recordedAt } }),
  })
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)

  await renderCard(order({ riderName: 'Asha' }))

  expect(await screen.findByRole('heading', { name: 'Your rider' })).toBeTruthy()
  expect(screen.getByText('Asha')).toBeTruthy()
  expect(screen.getByText('Out for delivery')).toBeTruthy()
  expect(screen.getByText('Last seen 3 minutes ago')).toBeTruthy()
  const read = calls.find((request) => new URL(request.url).pathname === delivery)
  expect(read?.headers.get('Authorization')).toBe('Bearer t-rider')

  await fireEvent.press(screen.getByRole('button', { name: 'Open in Maps' }))

  expect(open).toHaveBeenCalledWith('https://www.google.com/maps?q=12.9352,77.6245')
  open.mockRestore()
})

test('Rider without a position', async () => {
  setToken('t-rider')
  fakeCore({ [`GET ${delivery}`]: () => json(200, { riderName: 'Asha', status: 'assigned' }) })

  await renderCard(order({ riderName: 'Asha' }))

  expect(await screen.findByRole('heading', { name: 'Your rider' })).toBeTruthy()
  expect(screen.getByText('Asha')).toBeTruthy()
  await waitFor(() => expect(queryClient.getQueryState(deliveryKey('t-rider', 'o-1'))?.status).toBe('success'))
  expect(screen.queryByText(/Last seen/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Open in Maps' })).toBeNull()
})

test('No rider card before a rider', async () => {
  setToken('t-rider')
  const calls = fakeCore({})
  const ready = await renderCard(order({ id: 'o-2', status: 'ready' }))

  expect(screen.queryByRole('heading', { name: 'Your rider' })).toBeNull()
  expect(calls.some((request) => request.url.includes('/api/rider/'))).toBe(false)

  fakeCore({ [`GET ${delivery}`]: () => apiError(404, 'not_found') })
  await renderCard(order({ riderName: undefined }))

  await waitFor(() => expect(queryClient.getQueryState(deliveryKey('t-rider', 'o-1'))?.status).toBe('success'))
  expect(screen.queryByRole('heading', { name: 'Your rider' })).toBeNull()
})

test('Delivered order names the rider from the rider read', async () => {
  setToken('t-rider')
  fakeCore({ [`GET ${delivery}`]: () => json(200, { riderName: 'Arjun Rao', status: 'delivered' }) })

  await renderCard(order({ status: 'delivered', riderName: undefined }))

  expect(await screen.findByRole('heading', { name: 'Your rider' })).toBeTruthy()
  expect(screen.getByText('Arjun Rao')).toBeTruthy()
  expect(screen.getByText('Delivered')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Open in Maps' })).toBeNull()
})

test('Failed rider read keeps the card', async () => {
  setToken('t-rider')
  let down = false
  const recordedAt = minutesAgo(3)
  fakeCore({
    [`GET ${delivery}`]: () =>
      down
        ? Promise.reject(new TypeError('Network request failed'))
        : json(200, { riderName: 'Asha', status: 'assigned', location: { lat: 12.9352, lng: 77.6245, recordedAt } }),
  })

  await renderCard(order())

  expect(await screen.findByText('Asha')).toBeTruthy()
  expect(screen.getByText('Last seen 3 minutes ago')).toBeTruthy()

  down = true
  await act(() => queryClient.refetchQueries({ queryKey: deliveryKey('t-rider', 'o-1') }))

  expect(screen.getByText('Asha')).toBeTruthy()
  expect(screen.getByText('Last seen 3 minutes ago')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})
