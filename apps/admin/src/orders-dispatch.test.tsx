import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, indiranagar, json, koramangala, storeList } from './fake-core'
import { order, ordersCore } from './orders-fake'
import { dispatchRoute } from './riders-fake'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const asAdmin = { 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([indiranagar, koramangala]) }
const ready = () => within(screen.getByRole('region', { name: /^Ready/ })).getAllByRole('listitem')
const offer = (riderName: string, status: 'offered' | 'accepted' | 'declined' | 'expired', etaSeconds: number) => ({
  id: `00000000-0000-4000-8000-0000000009${String(etaSeconds % 100).padStart(2, '0')}`,
  riderName,
  status,
  etaSeconds,
  offeredAt: new Date().toISOString(),
  ...(status !== 'offered' && { answeredAt: new Date().toISOString() }),
})
const dispatchReads = (calls: Request[]) => calls.filter((call) => new URL(call.url).pathname.endsWith('/dispatch')).map((call) => new URL(call.url).pathname)

test('a ready order\'s card and sheet name the rider it is offered to and how far away', async () => {
  setToken('tok')
  const one = order(1, 'ready')
  const calls = fakeCore({
    ...asAdmin,
    ...ordersCore(indiranagar.id, [one, order(2, 'placed')]).routes,
    [dispatchRoute(one.id)]: () => json(200, { online: 2, dispatch: 'on', offers: [offer('Meera Iyer', 'offered', 90), offer('Arjun Rao', 'expired', 30)] }),
  })

  renderApp('/orders')

  await waitFor(() => expect(ready()[0]).toHaveTextContent('Offered to Meera Iyer, 2 min away'))
  expect(within(screen.getByRole('region', { name: /^Placed/ })).getByRole('listitem')).not.toHaveTextContent('Offered')
  await userEvent.click(within(ready()[0]).getByRole('button', { name: 'SS-TEST0001' }))
  expect(within(await screen.findByRole('dialog', { name: 'Order SS-TEST0001' })).getByText('Offered to Meera Iyer, 2 min away')).toBeInTheDocument()
  // Only the ready order is asked about; the card and the sheet share one read.
  expect(new Set(dispatchReads(calls))).toEqual(new Set([`/api/rider/v1/admin/orders/${one.id}/dispatch`]))
})

test('a ready order with no open offer says why: dispatch off at a store with no location, no rider online, or waiting', async () => {
  setToken('tok')
  const [off, nobody, waiting] = [order(1, 'ready'), order(2, 'ready'), order(3, 'ready')]
  fakeCore({
    ...asAdmin,
    [`GET /stores/${indiranagar.id}`]: () => json(200, indiranagar),
    ...ordersCore(indiranagar.id, [off, nobody, waiting]).routes,
    [dispatchRoute(off.id)]: () => json(200, { online: 0, dispatch: 'off', offers: [] }),
    [dispatchRoute(nobody.id)]: () => json(200, { online: 0, dispatch: 'on', offers: [] }),
    [dispatchRoute(waiting.id)]: () => json(200, { online: 2, dispatch: 'on', offers: [offer('Arjun Rao', 'declined', 30)] }),
  })

  renderApp('/orders')

  // The longest waiting first: SS-TEST0003, SS-TEST0002, SS-TEST0001.
  await waitFor(() => expect(ready()[2]).toHaveTextContent('Dispatch off: store has no location'))
  expect(ready()[1]).toHaveTextContent('No rider online')
  expect(ready()[0]).toHaveTextContent('Waiting for a rider')
})

test('dispatch off at a store that has a location says only that dispatch is off', async () => {
  setToken('tok')
  const one = order(1, 'ready')
  const calls = fakeCore({
    ...asAdmin,
    ...ordersCore(indiranagar.id, [one, order(2, 'ready')]).routes,
    [`GET /stores/${indiranagar.id}`]: () => json(200, { ...indiranagar, location: { lat: 12.9719, lng: 77.6412 } }),
    [dispatchRoute(one.id)]: () => json(200, { online: 1, dispatch: 'off', offers: [] }),
    [dispatchRoute(order(2, 'ready').id)]: () => json(200, { online: 1, dispatch: 'on', offers: [] }),
  })

  renderApp('/orders')

  await waitFor(() => expect(ready()[1]).toHaveTextContent(/^SS-TEST0001.*Dispatch off(?!:)/))
  expect(ready()[0]).toHaveTextContent('Waiting for a rider')
  // The store is read for the order whose dispatch is off, once.
  expect(calls.filter((call) => new URL(call.url).pathname === `/api/core/v1/stores/${indiranagar.id}`)).toHaveLength(1)
})

test('a dispatch read that fails shows no line; the board\'s next poll reads it again and shows the offer', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setToken('tok')
  const one = order(1, 'ready')
  const answers = [apiError(500, 'internal'), json(200, { online: 1, dispatch: 'on', offers: [offer('Arjun Rao', 'offered', 0)] })]
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [one]).routes, [dispatchRoute(one.id)]: () => answers.shift() ?? json(200, { online: 1, dispatch: 'on', offers: [] }) })

  renderApp('/orders')

  await waitFor(() => expect(dispatchReads(calls)).toHaveLength(1))
  expect(ready()[0]).not.toHaveTextContent(/Offered|online|Dispatch/)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await act(() => vi.advanceTimersByTimeAsync(10_000))

  await waitFor(() => expect(ready()[0]).toHaveTextContent('Offered to Arjun Rao, 0 min away'))
})
