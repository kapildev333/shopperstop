import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, fakeCore, indiranagar, json, storeList } from './fake-core'
import { listRequests, order, ordersCore } from './orders-fake'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const asAdmin = { 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([indiranagar]) }
const column = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`) })
const button = (name: string) => screen.getByRole('button', { name })

test('each card has one button, for the next status of its order, named with the order number', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'placed'), order(2, 'accepted'), order(3, 'packing'), order(4, 'ready'), order(5, 'out_for_delivery')]).routes })

  renderApp('/orders')

  await screen.findByText('SS-TEST0001')
  const names = ['Accept SS-TEST0001', 'Start packing SS-TEST0002', 'Mark ready SS-TEST0003', 'Send out SS-TEST0004', 'Mark delivered SS-TEST0005']
  ;['Placed', 'Accepted', 'Packing', 'Ready', 'Out for delivery'].forEach((name, i) => {
    expect(within(column(name)).getAllByRole('button', { name: /^(Accept|Start packing|Mark ready|Send out|Mark delivered) / })).toEqual([within(column(name)).getByRole('button', { name: names[i] })])
  })
})

test('a press sends the next status once, moves the card with core\'s answer and says so, without listing the orders again', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'placed'), order(2, 'placed')])
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await userEvent.click(button('Accept SS-TEST0001'))

  expect(await screen.findByText('SS-TEST0001 is now Accepted.')).toHaveAttribute('role', 'status')
  expect(within(column('Accepted')).getByRole('button', { name: 'Start packing SS-TEST0001' })).toBeInTheDocument()
  expect(within(column('Placed')).getAllByRole('listitem')).toHaveLength(1)
  expect(core.posts).toEqual([{ id: order(1, 'placed').id, body: { status: 'accepted' } }])
  expect(listRequests(calls)).toHaveLength(1)
})

test('while a status change runs the pressed button reads Saving…, keeps focus and is never disabled; a second press and another card\'s button send nothing', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'placed'), order(2, 'accepted')])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  core.hold('status')
  await userEvent.click(button('Accept SS-TEST0001'))

  const pressed = await screen.findByRole('button', { name: 'Saving… SS-TEST0001' })
  expect(pressed).toHaveFocus()
  expect(pressed).toBeEnabled()
  expect(pressed).toHaveAttribute('aria-disabled', 'true')
  expect(button('Start packing SS-TEST0002')).toHaveAttribute('aria-disabled', 'true')
  await userEvent.click(pressed)
  await userEvent.click(button('Start packing SS-TEST0002'))
  expect(core.posts).toHaveLength(1)

  core.release('status')
  expect(await screen.findByText('SS-TEST0001 is now Accepted.')).toBeInTheDocument()
  expect(core.posts).toHaveLength(1)
  expect(button('Start packing SS-TEST0002')).toHaveAttribute('aria-disabled', 'false')
})

test('after a move the keyboard is on the card\'s new button', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'placed')]).routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await userEvent.click(button('Accept SS-TEST0001'))

  await waitFor(() => expect(button('Start packing SS-TEST0001')).toHaveFocus())
})

test('Mark delivered asks first: Cancel sends nothing, confirming takes the order off the board and the keyboard goes to the result', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'out_for_delivery'), order(2, 'placed')])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await userEvent.click(button('Mark delivered SS-TEST0001'))
  const dialog = screen.getByRole('dialog', { name: 'Mark SS-TEST0001 delivered?' })
  expect(within(dialog).getAllByRole('button').map((each) => each.textContent)).toEqual(['Cancel', 'Mark delivered'])
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(core.posts).toEqual([])
  expect(button('Mark delivered SS-TEST0001')).toHaveFocus()

  await userEvent.click(button('Mark delivered SS-TEST0001'))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark delivered' }))

  const said = await screen.findByText('SS-TEST0001 is now Delivered.')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText('SS-TEST0001')).not.toBeInTheDocument()
  expect(core.posts).toEqual([{ id: order(1, 'placed').id, body: { status: 'delivered' } }])
  await waitFor(() => expect(said.parentElement).toHaveFocus())
})

test('a 409 reads the order again, shows it where it stands and says someone else changed it', async () => {
  setToken('tok')
  const orders = [order(1, 'placed'), order(2, 'placed')]
  const core = ordersCore(indiranagar.id, orders)
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  // Another staff member accepted the first order and the customer cancelled the second; this board has not polled since.
  orders[0] = { ...orders[0], status: 'accepted' }
  orders[1] = { ...orders[1], status: 'cancelled' }
  await userEvent.click(button('Accept SS-TEST0001'))

  expect(await screen.findByText('SS-TEST0001 was changed by someone else first: it is now Accepted.')).toHaveAttribute('role', 'status')
  expect(within(column('Accepted')).getByRole('button', { name: 'Start packing SS-TEST0001' })).toBeInTheDocument()
  expect(core.posts).toHaveLength(1)
  expect(calls.filter((call) => call.method === 'GET' && call.url.endsWith(`/admin/orders/${orders[0].id}`))).toHaveLength(1)

  await userEvent.click(button('Accept SS-TEST0002'))
  expect(await screen.findByText('SS-TEST0002 was changed by someone else first: it is now Cancelled.')).toBeInTheDocument()
  expect(screen.queryByText('SS-TEST0002')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a status change that fails says so, leaves the card where it is and can be tried again', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'placed')])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  core.fail('status')
  await userEvent.click(button('Accept SS-TEST0001'))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not change the status of SS-TEST0001. Try again.')
  expect(within(column('Placed')).getByText('SS-TEST0001')).toBeInTheDocument()
  expect(button('Accept SS-TEST0001')).toHaveFocus()

  core.fail('status', false)
  await userEvent.click(button('Accept SS-TEST0001'))
  expect(await screen.findByText('SS-TEST0001 is now Accepted.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(core.posts).toHaveLength(2)
})

test('a 409 whose order cannot be read again is a failed status change', async () => {
  setToken('tok')
  const orders = [order(1, 'placed')]
  const core = ordersCore(indiranagar.id, orders)
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  orders[0] = { ...orders[0], status: 'accepted' }
  core.fail('order')
  await userEvent.click(button('Accept SS-TEST0001'))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not change the status of SS-TEST0001. Try again.')
  expect(screen.queryByText(/is now/)).not.toBeInTheDocument()
})

test('a poll answer read before a status change never moves the card back', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'placed')])
  const calls = fakeCore({ ...asAdmin, ...core.routes })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  // The poll leaves, and core reads the order as placed; its answer is still in the air when the press is answered.
  core.hold('lists')
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(listRequests(calls)).toHaveLength(2)
  await user.click(button('Accept SS-TEST0001'))
  expect(await screen.findByText('SS-TEST0001 is now Accepted.')).toBeInTheDocument()

  core.release('lists')
  await act(() => vi.advanceTimersByTimeAsync(1_000))
  expect(within(column('Accepted')).getByText('SS-TEST0001')).toBeInTheDocument()
  expect(within(column('Placed')).getByText('No orders')).toBeInTheDocument()

  // The poll goes on afterwards.
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  await waitFor(() => expect(listRequests(calls)).toHaveLength(3))
})

test('the keyboard after a delivery is on a result named for what it holds', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'out_for_delivery'), order(2, 'placed')])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await userEvent.click(button('Mark delivered SS-TEST0001'))
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Mark SS-TEST0001 delivered?' })).getByRole('button', { name: 'Mark delivered' }))

  const result = await screen.findByRole('group', { name: 'Status change' })
  await waitFor(() => expect(result).toHaveFocus())
  expect(result).toHaveTextContent('SS-TEST0001 is now Delivered.')
})

test('an order that leaves the board takes its count with it: no note of orders not shown', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'out_for_delivery'), order(2, 'placed')]).routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await userEvent.click(button('Mark delivered SS-TEST0001'))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark delivered' }))

  expect(await screen.findByText('SS-TEST0001 is now Delivered.')).toBeInTheDocument()
  expect(screen.getByText('SS-TEST0002')).toBeInTheDocument()
  expect(screen.queryByText(/^Showing the newest/)).not.toBeInTheDocument()
})

test('Accept waits for the payment: aria-disabled and described by "Awaiting payment", a press sends nothing; once paid it accepts', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setToken('tok')
  const orders = [order(1, 'placed', { paymentMethod: 'online', paymentStatus: 'pending' }), order(2, 'placed')]
  const core = ordersCore(indiranagar.id, orders)
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  const accept = button('Accept SS-TEST0001')
  expect(accept).toHaveAttribute('aria-disabled', 'true')
  expect(accept).toBeEnabled()
  expect(accept).toHaveAccessibleDescription('Awaiting payment')
  expect(button('Accept SS-TEST0002')).not.toHaveAttribute('aria-disabled', 'true')
  await userEvent.click(accept)
  expect(core.posts).toEqual([])

  // The payment service marks it paid; the next poll brings it.
  orders[0] = { ...orders[0], paymentStatus: 'paid', paymentReference: 'pay_123' }
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  await waitFor(() => expect(button('Accept SS-TEST0001')).not.toHaveAttribute('aria-disabled', 'true'))
  expect(button('Accept SS-TEST0001')).not.toHaveAccessibleDescription()
  await userEvent.click(button('Accept SS-TEST0001'))
  expect(await screen.findByText('SS-TEST0001 is now Accepted.')).toBeInTheDocument()
  expect(core.posts).toEqual([{ id: orders[0].id, body: { status: 'accepted' } }])
})

test('a 409 payment_pending reads the order again, keeps it in Placed awaiting payment and says so, with no alert', async () => {
  setToken('tok')
  const orders = [order(1, 'placed', { paymentMethod: 'online', paymentStatus: 'paid', paymentReference: 'pay_123' })]
  const core = ordersCore(indiranagar.id, orders)
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  // Core holds the payment as pending, whatever this board was told before (a race the page cannot see).
  orders[0] = { ...orders[0], paymentStatus: 'pending', paymentReference: undefined }
  await userEvent.click(button('Accept SS-TEST0001'))

  expect(await screen.findByText('SS-TEST0001 is awaiting payment: accept it once it is paid.')).toHaveAttribute('role', 'status')
  expect(within(column('Placed')).getByText('Awaiting payment')).toBeInTheDocument()
  expect(button('Accept SS-TEST0001')).toHaveAttribute('aria-disabled', 'true')
  expect(button('Accept SS-TEST0001')).toHaveFocus()
  expect(core.posts).toHaveLength(1)
  expect(calls.filter((call) => call.method === 'GET' && call.url.endsWith(`/admin/orders/${orders[0].id}`))).toHaveLength(1)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText(/changed by someone else/)).not.toBeInTheDocument()
})
