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
const placedAt = '2026-10-13T09:20:00Z'
const first = order(1, 'placed', { placedAt, events: [{ toStatus: 'placed', actorType: 'customer', createdAt: placedAt }] })
const orderRequests = (calls: Request[], id: string) => calls.filter((call) => call.method === 'GET' && call.url.endsWith(`/admin/orders/${id}`))

// The cancel dialog, open over the sheet of SS-TEST0001.
const cancelDialog = () => screen.getByRole('dialog', { name: 'Cancel order SS-TEST0001?' })

// Opens the sheet of an order from its card.
async function openSheet(number = 'SS-TEST0001') {
  await userEvent.click(await screen.findByRole('button', { name: number }))
  return screen.getByRole('dialog', { name: `Order ${number}` })
}

test('a card\'s number opens the order: status, items, totals, customer with phone, address and events', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [first]).routes })

  renderApp('/orders')
  const sheet = await openSheet()

  expect(sheet).toHaveTextContent('Placed 13 Oct 2026, 2:50 pm')
  // D28: an order under way is accent.
  expect(within(sheet).getByText('Placed', { exact: true })).toHaveClass('bg-accent-soft')
  expect(within(sheet).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    '1 × Banana Robusta, 1 kg₹70',
    '3 × Pomegranate Bhagwa, 1 kg₹960',
    'Placed by the customer, 13 Oct 2026, 2:50 pm',
  ])
  expect(sheet).toHaveTextContent('Subtotal₹1,030Delivery fee₹0Total, cash on delivery₹1,030')
  expect(sheet).toHaveTextContent('Demo Customer')
  expect(within(sheet).getByRole('link', { name: '+919800000000' })).toHaveAttribute('href', 'tel:+919800000000')
  expect(sheet).toHaveTextContent('Home: 12 80 Feet Rd, Koramangala, 560034')
  expect(within(sheet).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Items', 'Customer', 'Address', 'History'])
  // The sheet shows the card's order at once and reads the order itself once.
  await waitFor(() => expect(orderRequests(calls, first.id)).toHaveLength(1))
})

test('the sheet shows the order as core holds it, not as the card did: a second address line, no phone, a note', async () => {
  setToken('tok')
  const orders = [first]
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, orders).routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  // Since the board's last poll another staff member accepted it with a note.
  orders[0] = {
    ...first,
    status: 'accepted',
    customerPhone: undefined,
    address: { ...first.address, line2: 'Flat 4' },
    events: [...first.events, { fromStatus: 'placed', toStatus: 'accepted', actorType: 'staff', note: 'Packing now', createdAt: '2026-10-13T09:21:00Z' }],
  }
  const sheet = await openSheet()

  expect(await within(sheet).findByText('Accepted by staff, 13 Oct 2026, 2:51 pm: Packing now')).toBeInTheDocument()
  expect(sheet).toHaveTextContent('Home: 12 80 Feet Rd, Koramangala, Flat 4, 560034')
  expect(within(sheet).getByText('No phone number')).toBeInTheDocument()
  expect(within(sheet).queryByRole('link')).not.toBeInTheDocument()
})

test('an open sheet follows the order every 10 seconds', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setToken('tok')
  const orders = [first]
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, orders).routes })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  renderApp('/orders')
  await user.click(await screen.findByRole('button', { name: 'SS-TEST0001' }))
  const sheet = screen.getByRole('dialog', { name: 'Order SS-TEST0001' })
  await waitFor(() => expect(orderRequests(calls, first.id)).toHaveLength(1))

  orders[0] = { ...first, status: 'packing' }
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(await within(sheet).findByText('Packing')).toBeInTheDocument()
  expect(orderRequests(calls, first.id)).toHaveLength(2)
  expect(within(sheet).queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument()
})

test('a failed refresh keeps the order on the sheet and says it could not refresh', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [first])
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  core.fail('order')
  const sheet = await openSheet()

  // The sheet says it itself: it is a modal over the notice at the root of the app.
  expect(await within(sheet).findByText('Could not refresh. Showing what was loaded last.')).toHaveAttribute('role', 'status')
  expect(orderRequests(calls, first.id)).toHaveLength(1)
  expect(sheet).toHaveTextContent('3 × Pomegranate Bhagwa')
  expect(within(sheet).getByRole('button', { name: 'Cancel order' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('only a placed or an accepted order can be cancelled from the sheet', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [first, order(2, 'accepted'), order(3, 'packing')]).routes })

  renderApp('/orders')
  for (const [number, offered] of [['SS-TEST0001', true], ['SS-TEST0002', true], ['SS-TEST0003', false]] as const) {
    const sheet = await openSheet(number)
    expect(within(sheet).queryAllByRole('button', { name: 'Cancel order' })).toHaveLength(offered ? 1 : 0)
    await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
  }
})

test('closing the sheet puts the keyboard back on the card', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [first]).routes })

  renderApp('/orders')
  const sheet = await openSheet()
  await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'SS-TEST0001' })).toHaveFocus()
})

test('a cancel needs a reason: without one nothing is sent, the field says so, and the message goes when a reason is typed', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [first])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await userEvent.click(within(await openSheet()).getByRole('button', { name: 'Cancel order' }))

  // The dialog opens over the sheet, which stays open under it.
  const dialog = cancelDialog()
  expect(screen.getByRole('dialog', { name: 'Order SS-TEST0001' })).toBeInTheDocument()
  expect(within(dialog).getAllByRole('button').map((each) => each.textContent)).toEqual(['Keep order', 'Cancel order'])
  const reason = within(dialog).getByLabelText('Reason')
  expect(reason).toHaveFocus()
  expect(reason).toHaveAttribute('maxlength', '500')
  await userEvent.type(reason, '   ')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel order' }))
  expect(reason).toHaveAccessibleDescription('Enter a reason.')
  expect(reason).toBeInvalid()
  expect(core.posts).toEqual([])

  await userEvent.type(reason, 'x')
  expect(reason).not.toHaveAccessibleDescription()
  expect(reason).toBeValid()
})

test('Keep order and Escape close only the dialog, without sending, and the keyboard is back on the sheet', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [first])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  const sheet = await openSheet()
  await userEvent.click(within(sheet).getByRole('button', { name: 'Cancel order' }))
  await userEvent.click(within(cancelDialog()).getByRole('button', { name: 'Keep order' }))
  expect(screen.getAllByRole('dialog')).toEqual([sheet])
  expect(within(sheet).getByRole('button', { name: 'Cancel order' })).toHaveFocus()

  await userEvent.click(within(sheet).getByRole('button', { name: 'Cancel order' }))
  await userEvent.keyboard('{Escape}')
  expect(screen.getAllByRole('dialog')).toEqual([sheet])
  expect(within(sheet).getByRole('button', { name: 'Cancel order' })).toHaveFocus()
  expect(core.posts).toEqual([])
})

test('a cancel sends the reason as the note once, takes the order off the board and shows it cancelled with the reason', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [first, order(2, 'placed')])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await userEvent.click(within(await openSheet()).getByRole('button', { name: 'Cancel order' }))
  await userEvent.type(screen.getByLabelText('Reason'), ' Out of stock ')
  await userEvent.click(within(cancelDialog()).getByRole('button', { name: 'Cancel order' }))

  const sheet = await screen.findByRole('dialog', { name: 'Order SS-TEST0001' })
  expect(within(sheet).getByText('Order cancelled.')).toHaveAttribute('role', 'status')
  // The dialog is gone and the keyboard is on the result, inside the sheet.
  expect(screen.getAllByRole('dialog')).toEqual([sheet])
  expect(within(sheet).getByRole('group', { name: 'Cancel result' })).toHaveFocus()
  // D28: cancelled is neutral, never a danger or a warning colour.
  expect(within(sheet).getByText('Cancelled')).toHaveClass('bg-canvas')
  expect(within(sheet).getByText('Reason for cancelling: Out of stock')).toBeInTheDocument()
  expect(within(sheet).getByText(/^Cancelled by staff, .*: Out of stock$/)).toBeInTheDocument()
  expect(within(sheet).queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument()
  expect(core.posts).toEqual([{ id: first.id, body: { status: 'cancelled', note: 'Out of stock' } }])

  await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
  expect(screen.queryByText('SS-TEST0001')).not.toBeInTheDocument()
  expect(screen.getByText('SS-TEST0002')).toBeInTheDocument()
})

test('while a cancel runs the button reads Cancelling…, keeps focus and is never disabled; a second press sends nothing and the dialog stays', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [first])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await userEvent.click(within(await openSheet()).getByRole('button', { name: 'Cancel order' }))
  await userEvent.type(screen.getByLabelText('Reason'), 'Out of stock')
  core.hold('status')
  await userEvent.click(within(cancelDialog()).getByRole('button', { name: 'Cancel order' }))

  const pressed = await screen.findByRole('button', { name: 'Cancelling…' })
  expect(pressed).toHaveFocus()
  expect(pressed).toBeEnabled()
  expect(pressed).toHaveAttribute('aria-disabled', 'true')
  await userEvent.click(pressed)
  await userEvent.click(within(cancelDialog()).getByRole('button', { name: 'Keep order' }))
  await userEvent.keyboard('{Escape}')
  expect(cancelDialog()).toBeInTheDocument()
  expect(core.posts).toHaveLength(1)

  core.release('status')
  expect(await screen.findByText('Order cancelled.')).toBeInTheDocument()
  expect(core.posts).toHaveLength(1)
})

test('a cancel that fails says so in the dialog, keeps the reason and can be tried again', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [first])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await userEvent.click(within(await openSheet()).getByRole('button', { name: 'Cancel order' }))
  await userEvent.type(screen.getByLabelText('Reason'), 'Out of stock')
  core.fail('status')
  await userEvent.click(within(cancelDialog()).getByRole('button', { name: 'Cancel order' }))

  const dialog = screen.getByRole('dialog', { name: 'Cancel order SS-TEST0001?' })
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not cancel the order. Try again.')
  expect(screen.getByLabelText('Reason')).toHaveValue('Out of stock')

  core.fail('status', false)
  await userEvent.click(within(cancelDialog()).getByRole('button', { name: 'Cancel order' }))
  expect(await screen.findByText('Order cancelled.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(core.posts).toHaveLength(2)
})

test('a cancel refused with 409 shows where the order stands instead, on the sheet and on the board', async () => {
  setToken('tok')
  const orders = [order(1, 'accepted')]
  const core = ordersCore(indiranagar.id, orders)
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  const opened = await openSheet()
  await waitFor(() => expect(within(opened).getByRole('button', { name: 'Cancel order' })).toBeInTheDocument())
  await userEvent.click(within(opened).getByRole('button', { name: 'Cancel order' }))
  await userEvent.type(screen.getByLabelText('Reason'), 'Out of stock')
  // Packing has started at the store meanwhile: staff can no longer cancel.
  orders[0] = { ...orders[0], status: 'packing' }
  await userEvent.click(within(cancelDialog()).getByRole('button', { name: 'Cancel order' }))

  const sheet = await screen.findByRole('dialog', { name: 'Order SS-TEST0001' })
  expect(within(sheet).getByText('Someone else changed this order first: it is now Packing.')).toHaveAttribute('role', 'status')
  expect(within(sheet).queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument()
  expect(within(sheet).queryByText('Order cancelled.')).not.toBeInTheDocument()
  await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
  expect(screen.getByRole('button', { name: 'Mark ready SS-TEST0001' })).toBeInTheDocument()
})

test('a poll answer read before a cancel never puts the order back on the board', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setToken('tok')
  const core = ordersCore(indiranagar.id, [first, order(2, 'placed')])
  const calls = fakeCore({ ...asAdmin, ...core.routes })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  renderApp('/orders')
  await user.click(await screen.findByRole('button', { name: 'SS-TEST0001' }))
  await user.click(within(screen.getByRole('dialog', { name: 'Order SS-TEST0001' })).getByRole('button', { name: 'Cancel order' }))
  await user.type(screen.getByLabelText('Reason'), 'Out of stock')
  // The poll leaves, and core reads the order as placed; its answer is still in the air when the cancel is answered.
  core.hold('lists')
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(listRequests(calls)).toHaveLength(2)
  await user.click(within(cancelDialog()).getByRole('button', { name: 'Cancel order' }))
  const sheet = await screen.findByRole('dialog', { name: 'Order SS-TEST0001' })
  expect(within(sheet).getByText('Order cancelled.')).toBeInTheDocument()

  core.release('lists')
  await act(() => vi.advanceTimersByTimeAsync(1_000))
  await user.click(within(sheet).getByRole('button', { name: 'Close' }))
  expect(screen.queryByText('SS-TEST0001')).not.toBeInTheDocument()
  expect(screen.getByText('SS-TEST0002')).toBeInTheDocument()
})

test('the sheet names the order\'s rider, and the rider on the events the rider made', async () => {
  setToken('tok')
  const delivered = order(1, 'delivered', {
    riderName: 'Arjun Rao',
    events: [
      { toStatus: 'placed', actorType: 'customer', createdAt: '2026-10-13T09:20:00Z' },
      { fromStatus: 'placed', toStatus: 'accepted', actorType: 'staff', createdAt: '2026-10-13T09:21:00Z' },
      { fromStatus: 'ready', toStatus: 'out_for_delivery', actorType: 'rider', actorName: 'Arjun Rao', createdAt: '2026-10-13T09:25:00Z' },
      { fromStatus: 'out_for_delivery', toStatus: 'delivered', actorType: 'rider', actorName: 'Arjun Rao', createdAt: '2026-10-13T09:31:00Z' },
    ],
  })
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [delivered]).routes })

  renderApp('/orders?tab=history')
  await userEvent.click(await screen.findByRole('button', { name: 'SS-TEST0001' }))
  const sheet = screen.getByRole('dialog', { name: 'Order SS-TEST0001' })

  expect(await within(sheet).findByText('Rider: Arjun Rao')).toBeInTheDocument()
  expect(within(sheet).getAllByRole('listitem').slice(2).map((item) => item.textContent)).toEqual([
    'Placed by the customer, 13 Oct 2026, 2:50 pm',
    'Accepted by staff, 13 Oct 2026, 2:51 pm',
    'Out for delivery by Arjun Rao, 13 Oct 2026, 2:55 pm',
    'Delivered by Arjun Rao, 13 Oct 2026, 3:01 pm',
  ])
})
