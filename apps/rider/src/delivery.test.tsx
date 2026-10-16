import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { apiError, delivery, fakeApi, json, signedInRoutes } from './fake-api'
import { fakeGeolocation } from './fake-geolocation'
import { renderApp } from './render-app'

const id = delivery().id
const deliveryPath = `/api/rider/v1/me/deliveries/${id}`
const markPath = `${deliveryPath}/delivered`
const cash = 'Collect ₹339 cash'

let geo: ReturnType<typeof fakeGeolocation>

beforeEach(() => {
  setToken('tok')
  geo = fakeGeolocation()
})

afterEach(() => {
  geo.remove()
  clearToken()
  vi.unstubAllGlobals()
})

// The delivery page of `shown`, with the signed-in routes and the delivery's answer.
function openDelivery(shown = delivery(), extra: Parameters<typeof fakeApi>[0] = {}) {
  const calls = fakeApi({ ...signedInRoutes(), [`GET ${deliveryPath}`]: () => json(200, shown), ...extra })
  renderApp(`/deliveries/${id}`)
  return calls
}

async function confirmDelivered(number = 'SS-AAAA0001') {
  await userEvent.click(await screen.findByRole('button', { name: 'Mark delivered' }))
  const dialog = screen.getByRole('dialog', { name: `Mark ${number} delivered?` })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Mark delivered' }))
  return dialog
}

test('assigned delivery shown', async () => {
  openDelivery()

  expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-AAAA0001' })).toBeInTheDocument()
  expect(screen.getByText('On the way')).toBeInTheDocument()
  const customer = screen.getByRole('region', { name: 'Customer' })
  expect(within(customer).getByText('Ravi Kumar')).toBeInTheDocument()
  expect(customer).toHaveTextContent('12 80 Feet Rd')
  expect(customer).toHaveTextContent('Flat 4')
  expect(customer).toHaveTextContent('560034')
  expect(within(customer).getByRole('link', { name: 'Call Ravi Kumar' })).toHaveAttribute('href', 'tel:+919800000001')
  const items = screen.getByRole('table', { name: 'Items' })
  expect(within(items).getByRole('row', { name: /Banana Robusta/ })).toHaveTextContent('Banana RobustaUnit1 kgQuantity2')
  expect(screen.getByText('₹339')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent(cash)
  expect(screen.getByRole('button', { name: 'Mark delivered' })).toBeInTheDocument()
})

test('unknown delivery', async () => {
  openDelivery(delivery(), { [`GET ${deliveryPath}`]: () => apiError(404, 'not_found') })

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
})

test('cash on delivery', async () => {
  openDelivery()

  expect(await screen.findByText(cash)).toBeInTheDocument()
})

test('no cash line for a payment made online', async () => {
  openDelivery(delivery({ paymentMethod: 'online' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-AAAA0001' })).toBeInTheDocument()
  expect(screen.queryByText(/Collect/)).not.toBeInTheDocument()
})

test('delivered shows no collection', async () => {
  openDelivery(delivery({ status: 'delivered', deliveredAt: new Date().toISOString() }))

  expect(await screen.findByText('Delivered')).toBeInTheDocument()
  expect(screen.queryByText(/Collect/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Mark delivered' })).not.toBeInTheDocument()
})

test('tel link only when a phone exists', async () => {
  openDelivery(delivery({ customerPhone: undefined }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-AAAA0001' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Customer' })).toHaveTextContent('Ravi Kumar')
  expect(screen.queryByRole('link', { name: /Call/ })).not.toBeInTheDocument()
})

test('cancel sends nothing', async () => {
  const calls = openDelivery()

  await userEvent.click(await screen.findByRole('button', { name: 'Mark delivered' }))
  const dialog = screen.getByRole('dialog', { name: 'Mark SS-AAAA0001 delivered?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0)
})

test('delivered', async () => {
  const calls = openDelivery(delivery(), {
    [`POST ${markPath}`]: () => json(200, delivery({ status: 'delivered', deliveredAt: new Date().toISOString() })),
  })

  await confirmDelivered()

  expect(await screen.findByText('SS-AAAA0001 delivered.')).toBeInTheDocument()
  expect(screen.getByText('Delivered')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Mark delivered' })).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(calls.filter((call) => call.method === 'POST' && call.url.endsWith(markPath))).toHaveLength(1)
})

test('core fails', async () => {
  openDelivery(delivery(), { [`POST ${markPath}`]: () => apiError(502, 'internal') })

  const dialog = await confirmDelivered()

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not mark the order delivered. Try again.')
  expect(screen.getByText('On the way')).toBeInTheDocument()
})

test('refused 409 closes the dialog and reads the delivery again', async () => {
  const calls = openDelivery(delivery(), { [`POST ${markPath}`]: () => apiError(409, 'conflict', 'delivery is not assigned') })

  await confirmDelivered()

  expect(await screen.findByRole('button', { name: 'Mark delivered' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(calls.filter((call) => call.method === 'GET' && call.url.endsWith(deliveryPath))).toHaveLength(2)
})
