import { queryClient } from './api'
import { deliveryOptions, lastSeen, mapsUrl, riderUrl } from './rider'
import { apiError, fakeCore } from './fake-core'

const statuses = ['placed', 'accepted', 'packing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'] as const

test('Default rider URL', async () => {
  const saved = process.env.EXPO_PUBLIC_RIDER_URL
  delete process.env.EXPO_PUBLIC_RIDER_URL
  try {
    jest.resetModules()
    const fresh = jest.requireActual<typeof import('./rider')>('./rider')

    expect(fresh.riderUrl).toBe('http://localhost:8081/api/rider/v1')
  } finally {
    if (saved === undefined) delete process.env.EXPO_PUBLIC_RIDER_URL
    else process.env.EXPO_PUBLIC_RIDER_URL = saved
  }
})

test('Rider read follows the status', () => {
  expect(riderUrl.endsWith('/api/rider/v1')).toBe(true)
  for (const status of statuses) {
    const options = deliveryOptions('t-1', 'o-1', status)
    const enabled = status === 'out_for_delivery' || status === 'delivered'
    expect(options.enabled).toBe(enabled)
    expect(options.refetchInterval).toBe(status === 'out_for_delivery' ? 10_000 : false)
  }
})

test('Last seen wording', () => {
  const now = Date.parse('2026-10-16T10:00:00Z')
  const ago = (ms: number) => new Date(now - ms).toISOString()
  const minute = 60_000
  expect(lastSeen(ago(30_000), now)).toBe('Last seen just now')
  expect(lastSeen(ago(minute), now)).toBe('Last seen 1 minute ago')
  expect(lastSeen(ago(59 * minute), now)).toBe('Last seen 59 minutes ago')
  expect(lastSeen(ago(60 * minute), now)).toBe('Last seen 1 hour ago')
  expect(lastSeen(ago(150 * minute), now)).toBe('Last seen 2 hours ago')
  expect(lastSeen(new Date(now + 2 * minute).toISOString(), now)).toBe('Last seen just now')
})

test('mapsUrl links the position', () => {
  expect(mapsUrl(12.9352, 77.6245)).toBe('https://www.google.com/maps?q=12.9352,77.6245')
})

test('a 404 from the rider read is no rider', async () => {
  fakeCore({ 'GET /api/rider/v1/orders/o-1/delivery': () => apiError(404, 'not_found') })

  const delivery = await queryClient.fetchQuery(deliveryOptions('t-1', 'o-1', 'out_for_delivery'))

  expect(delivery).toBeNull()
})

// As the order reads do: a failed read rejects with core's inner error (code and message), not the whole envelope.
test('a 500 on the delivery read rejects with the inner error', async () => {
  fakeCore({ 'GET /api/rider/v1/orders/o-1/delivery': () => apiError(500, 'internal', 'Something went wrong') })

  await expect(queryClient.fetchQuery(deliveryOptions('t-1', 'o-1', 'out_for_delivery'))).rejects.toMatchObject({
    code: 'internal',
    message: 'Something went wrong',
  })
})
