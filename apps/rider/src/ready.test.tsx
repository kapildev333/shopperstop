import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { apiError, delivery, fakeApi, json, readyOrder, signedInRoutes } from './fake-api'
import { renderApp } from './render-app'

type Routes = Parameters<typeof fakeApi>[0]

const READY = 'GET /api/rider/v1/me/ready-orders'
const DELIVERIES = 'GET /api/rider/v1/me/deliveries'
const CLAIM = 'POST /api/rider/v1/me/deliveries'
const DELIVERY_ID = '00000000-0000-4000-8000-000000000901'

const none = { items: [], page: 1, pageSize: 24, total: 0 }

// The signed-in page with nothing ready and nothing assigned, overridden per test.
function routes(over: Routes = {}): Routes {
  return {
    ...signedInRoutes(),
    [READY]: () => json(200, { items: [] }),
    [DELIVERIES]: () => json(200, none),
    ...over,
  }
}

afterEach(() => {
  clearToken()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('ready orders listed', async () => {
  setToken('tok')
  fakeApi(routes({ [READY]: () => json(200, { items: [readyOrder(1), readyOrder(2)] }) }))

  renderApp('/')

  const list = await screen.findByRole('list', { name: 'Ready orders' })
  expect(list).toHaveAttribute('aria-live', 'polite')
  const cards = within(list).getAllByRole('listitem')
  expect(cards).toHaveLength(2)
  expect(cards[0]).toHaveTextContent('SS-AAAA0001')
  expect(within(cards[0]).getByText('12 min ago')).toBeInTheDocument()
  expect(within(cards[0]).getByText('3 items')).toBeInTheDocument()
  expect(within(cards[0]).getByText('₹339')).toBeInTheDocument()
  expect(within(cards[0]).getByText('560034')).toBeInTheDocument()
  expect(cards[1]).toHaveTextContent('SS-AAAA0002')
})

test('new order appears without a reload', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setToken('tok')
  let reads = 0
  fakeApi(
    routes({
      [READY]: () => {
        reads += 1
        return json(200, { items: reads === 1 ? [readyOrder(1)] : [readyOrder(1), readyOrder(2)] })
      },
    }),
  )

  renderApp('/')

  expect(await screen.findByText('SS-AAAA0001')).toBeInTheDocument()
  expect(screen.queryByText('SS-AAAA0002')).not.toBeInTheDocument()
  await vi.advanceTimersByTimeAsync(10_000)
  expect(await screen.findByText('SS-AAAA0002')).toBeInTheDocument()
})

test('loading shows a skeleton', async () => {
  setToken('tok')
  fakeApi(routes({ [READY]: () => new Promise<Response>(() => {}) }))

  renderApp('/')

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Ready orders' })).not.toBeInTheDocument()
})

test('no ready orders', async () => {
  setToken('tok')
  fakeApi(routes())

  renderApp('/')

  expect(await screen.findByRole('heading', { level: 2, name: 'No orders ready' })).toBeInTheDocument()
  expect(screen.getByText('New orders show here as the store packs them.')).toBeInTheDocument()
})

test('read fails', async () => {
  setToken('tok')
  let reads = 0
  const calls = fakeApi(
    routes({
      [READY]: () => {
        reads += 1
        return reads === 1 ? apiError(502, 'internal') : json(200, { items: [readyOrder(1)] })
      },
    }),
  )

  renderApp('/')

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load ready orders.')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('SS-AAAA0001')).toBeInTheDocument()
  expect(calls.filter((call) => call.url.endsWith('/me/ready-orders'))).toHaveLength(2)
})

test('assigned delivery linked', async () => {
  setToken('tok')
  const id = '00000000-0000-4000-8000-000000000903'
  fakeApi(
    routes({
      [DELIVERIES]: () => json(200, { ...none, items: [delivery({ id, orderNumber: 'SS-AAAA0003', customerName: 'Ravi Kumar' })], total: 1 }),
    }),
  )

  renderApp('/')

  const section = await screen.findByRole('region', { name: 'Your deliveries' })
  expect(within(section).getByRole('link', { name: 'SS-AAAA0003 Ravi Kumar' })).toHaveAttribute('href', `/deliveries/${id}`)
})

test('none assigned', async () => {
  setToken('tok')
  fakeApi(routes())

  renderApp('/')

  expect(await screen.findByRole('heading', { level: 2, name: 'No orders ready' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Your deliveries' })).not.toBeInTheDocument()
})

test('pick up succeeds', async () => {
  setToken('tok')
  const claimed = delivery({ id: DELIVERY_ID, orderId: readyOrder(1).orderId, orderNumber: 'SS-AAAA0001' })
  const calls = fakeApi(
    routes({
      [READY]: () => json(200, { items: [readyOrder(1)] }),
      [CLAIM]: () => json(201, claimed),
      [`GET /api/rider/v1/me/deliveries/${DELIVERY_ID}`]: () => json(200, claimed),
    }),
  )
  const user = userEvent.setup()

  renderApp('/')

  await user.click(await screen.findByRole('button', { name: 'Pick up SS-AAAA0001' }))
  const dialog = screen.getByRole('dialog', { name: 'Pick up SS-AAAA0001?' })
  await user.click(within(dialog).getByRole('button', { name: 'Pick up' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-AAAA0001' })).toBeInTheDocument()
  const claims = calls.filter((call) => call.method === 'POST')
  expect(claims).toHaveLength(1)
  expect(await claims[0].clone().json()).toEqual({ orderId: readyOrder(1).orderId })
})

test('cancel sends nothing', async () => {
  setToken('tok')
  const calls = fakeApi(routes({ [READY]: () => json(200, { items: [readyOrder(1)] }) }))
  const user = userEvent.setup()

  renderApp('/')

  await user.click(await screen.findByRole('button', { name: 'Pick up SS-AAAA0001' }))
  const dialog = screen.getByRole('dialog', { name: 'Pick up SS-AAAA0001?' })
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(calls.some((call) => call.method === 'POST')).toBe(false)
})

test('claimed by someone else', async () => {
  setToken('tok')
  const calls = fakeApi(
    routes({
      [READY]: () => json(200, { items: [readyOrder(1)] }),
      [CLAIM]: () => apiError(409, 'conflict', 'order already claimed'),
    }),
  )
  const user = userEvent.setup()

  renderApp('/')

  await user.click(await screen.findByRole('button', { name: 'Pick up SS-AAAA0001' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Pick up' }))

  expect(await screen.findByText('SS-AAAA0001 was taken by another rider or is no longer ready.')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await waitFor(() => expect(calls.filter((call) => call.url.endsWith('/me/ready-orders'))).toHaveLength(2))
})

test('service fails', async () => {
  setToken('tok')
  fakeApi(
    routes({
      [READY]: () => json(200, { items: [readyOrder(1)] }),
      [CLAIM]: () => apiError(502, 'internal'),
    }),
  )
  const user = userEvent.setup()

  const router = renderApp('/')

  await user.click(await screen.findByRole('button', { name: 'Pick up SS-AAAA0001' }))
  const dialog = screen.getByRole('dialog', { name: 'Pick up SS-AAAA0001?' })
  await user.click(within(dialog).getByRole('button', { name: 'Pick up' }))

  expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(
    'Could not pick up the order. Try again.',
  )
  expect(router.state.location.pathname).toBe('/')
  expect(screen.getByRole('heading', { level: 1, name: 'Ready to pick up' })).toBeInTheDocument()
})

test('cancel waits for a pending pick up', async () => {
  setToken('tok')
  const answers: Array<(response: Response) => void> = []
  fakeApi(
    routes({
      [READY]: () => json(200, { items: [readyOrder(1)] }),
      [CLAIM]: () => new Promise<Response>((resolve) => answers.push(resolve)),
    }),
  )
  const user = userEvent.setup()

  renderApp('/')

  await user.click(await screen.findByRole('button', { name: 'Pick up SS-AAAA0001' }))
  const dialog = screen.getByRole('dialog', { name: 'Pick up SS-AAAA0001?' })
  await user.click(within(dialog).getByRole('button', { name: 'Pick up' }))
  await waitFor(() => expect(answers).toHaveLength(1))
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  await user.keyboard('{Escape}')

  expect(screen.getByRole('dialog', { name: 'Pick up SS-AAAA0001?' })).toBeInTheDocument()

  answers[0](apiError(409, 'conflict', 'order already claimed'))
  expect(await screen.findByText('SS-AAAA0001 was taken by another rider or is no longer ready.')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
