import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, json, koramangala, storeList } from './fake-core'
import { renderApp } from './render-app'
import type { AdminStore } from './stores'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const storePath = `/admin/stores/${koramangala.id}`
const signedIn = { 'GET /admin/me': () => json(200, admin) }
const withStore = {
  ...signedIn,
  [`GET ${storePath}`]: () => json(200, koramangala),
  [`GET ${storePath}/service-areas`]: () => json(200, { pincodes: ['560034', '560095'] }),
}

// Answers PATCH requests in turn with the given stores.
function queuedPatches(stores: object[]) {
  const queue = [...stores]
  return () => json(200, queue.shift())
}

async function replace(label: string, value: string) {
  const field = await screen.findByLabelText(label)
  await userEvent.clear(field)
  if (value) await userEvent.type(field, value)
}

test('create a store and open it', async () => {
  setToken('tok')
  const created = { ...koramangala, id: '00000000-0000-4000-8000-000000000499', name: 'HSR Layout', isOpen: false }
  const calls = fakeCore({
    ...signedIn,
    'POST /admin/stores': () => json(201, created),
    [`GET /admin/stores/${created.id}/service-areas`]: () => json(200, { pincodes: [] }),
    [`GET /admin/stores/${created.id}`]: () => json(200, created),
  })

  const router = renderApp('/stores/new')
  expect(await screen.findByRole('heading', { level: 1, name: 'New store' })).toBeInTheDocument()
  expect(screen.getByLabelText('Status')).toHaveValue('closed')
  await replace('Name', 'HSR Layout')
  await replace('Address', '27th Main, HSR Layout')
  await replace('City', 'Bengaluru')
  await replace('Pincode', '560102')
  await replace('Delivery fee (₹)', '25')
  await replace('Free delivery above (₹)', '199.50')
  await replace('Promised minutes', '12')
  await userEvent.click(screen.getByRole('button', { name: 'Create store' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'HSR Layout' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(`/stores/${created.id}`)
  const post = calls.find((call) => call.method === 'POST')!
  expect(await post.json()).toEqual({
    name: 'HSR Layout',
    city: 'Bengaluru',
    addressLine: '27th Main, HSR Layout',
    pincode: '560102',
    isOpen: false,
    deliveryFeeCents: 2500,
    freeDeliveryAboveCents: 19950,
    minOrderCents: 0,
    promisedMinutes: 12,
  })
})

test('edit sends only the changed fields and confirms', async () => {
  setToken('tok')
  const calls = fakeCore({
    ...withStore,
    [`PATCH ${storePath}`]: () => json(200, { ...koramangala, promisedMinutes: 11, isOpen: false }),
  })

  renderApp(`/stores/${koramangala.id}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Koramangala' })).toBeInTheDocument()
  expect(screen.getByLabelText('Delivery fee (₹)')).toHaveValue('25')
  expect(screen.getByLabelText('Free delivery above (₹)')).toHaveValue('199')
  expect(screen.getByLabelText('City')).toHaveValue('')
  await replace('Promised minutes', '11')
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'closed')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Store saved.')).toBeInTheDocument()
  const patch = calls.find((call) => call.method === 'PATCH')!
  expect(await patch.json()).toEqual({ promisedMinutes: 11, isOpen: false })
  expect(screen.getByLabelText('Promised minutes')).toHaveValue('11')
})

test('edit sets and clears the city', async () => {
  setToken('tok')
  const calls = fakeCore({
    ...signedIn,
    [`GET ${storePath}`]: () => json(200, { ...koramangala, city: 'Bengaluru' }),
    [`GET ${storePath}/service-areas`]: () => json(200, { pincodes: ['560034', '560095'] }),
    [`PATCH ${storePath}`]: queuedPatches([{ ...koramangala }, { ...koramangala, city: 'Bangalore' }]),
  })

  renderApp(`/stores/${koramangala.id}`)
  expect(await screen.findByLabelText('City')).toHaveValue('Bengaluru')
  await replace('City', '')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText('Store saved.')
  await replace('City', 'Bangalore')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(2))

  const patches = calls.filter((call) => call.method === 'PATCH')
  expect(await patches[0].json()).toEqual({ city: '' })
  expect(await patches[1].json()).toEqual({ city: 'Bangalore' })
})

test('a city error from core is shown on its field', async () => {
  setToken('tok')
  fakeCore({ ...withStore, [`PATCH ${storePath}`]: () => apiError(400, 'validation', 'city must be at most 100 characters', 'city') })

  renderApp(`/stores/${koramangala.id}`)
  await replace('City', 'a'.repeat(101))
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.getByLabelText('City')).toHaveAccessibleDescription(/Enter at most 100 characters\./))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a validation error from core is shown on its field', async () => {
  setToken('tok')
  fakeCore({ ...withStore, [`PATCH ${storePath}`]: () => apiError(400, 'validation', 'name must be 1 to 100 characters', 'name') })

  renderApp(`/stores/${koramangala.id}`)
  await replace('Name', '   ')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Enter 1 to 100 characters.'))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText('Store saved.')).not.toBeInTheDocument()
})

test('a value the form cannot send is flagged without a request', async () => {
  setToken('tok')
  const calls = fakeCore(withStore)

  renderApp(`/stores/${koramangala.id}`)
  await replace('Delivery fee (₹)', '-1')
  await replace('Promised minutes', '')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(screen.getByLabelText('Delivery fee (₹)')).toHaveAccessibleDescription('Enter 0 to 100000 rupees, at most two decimals.')
  expect(screen.getByLabelText('Promised minutes')).toHaveAccessibleDescription('Enter 1 to 240 minutes.')
  expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
})

test('any other save error shows a banner', async () => {
  setToken('tok')
  fakeCore({ ...withStore, [`PATCH ${storePath}`]: () => apiError(500, 'internal') })

  renderApp(`/stores/${koramangala.id}`)
  await replace('Promised minutes', '11')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the store. Try again.')
})

test('an unknown store shows not found', async () => {
  setToken('tok')
  fakeCore(signedIn)

  const router = renderApp('/stores/00000000-0000-4000-8000-000000000000')

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/stores/00000000-0000-4000-8000-000000000000')
  const nav = screen.getByRole('navigation', { name: 'Admin' })
  expect(within(nav).getByRole('link', { name: 'Stores' })).toHaveAttribute('aria-current', 'page')
})

// A fake core that keeps the store: PATCH merges the body, GETs answer the current values.
function keepsStore(start: AdminStore = koramangala) {
  let current = { ...start }
  return fakeCore({
    ...signedIn,
    'GET /admin/stores': () => storeList([current]),
    [`GET ${storePath}`]: () => json(200, current),
    [`GET ${storePath}/service-areas`]: () => json(200, { pincodes: ['560034', '560095'] }),
    [`PATCH ${storePath}`]: async (request) => {
      current = { ...current, ...(await request.clone().json()) }
      return json(200, current)
    },
  })
}

test('a second save sends only its own change', async () => {
  setToken('tok')
  const calls = keepsStore()

  renderApp(`/stores/${koramangala.id}`)
  await replace('Promised minutes', '11')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText('Store saved.')
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'closed')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await screen.findByText('Store saved.')
  const patches = calls.filter((call) => call.method === 'PATCH')
  expect(patches).toHaveLength(2)
  expect(await patches[1].json()).toEqual({ isOpen: false })
})

test('the stores table shows a saved change', async () => {
  setToken('tok')
  keepsStore()

  renderApp('/stores')
  await userEvent.click(await screen.findByRole('link', { name: 'Koramangala' }))
  await replace('Promised minutes', '11')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText('Store saved.')
  await userEvent.click(within(screen.getByRole('navigation', { name: 'Admin' })).getByRole('link', { name: 'Stores' }))

  expect(await within(await screen.findByRole('table', { name: 'Stores' })).findByText('11 min')).toBeInTheDocument()
})

// Koramangala as the demo seed has it (services/core/internal/seed).
const located: AdminStore = { ...koramangala, location: { lat: 12.9352, lng: 77.6245 } }

test('create a store with a location sends both coordinates', async () => {
  setToken('tok')
  const created = { ...koramangala, id: '00000000-0000-4000-8000-000000000499', name: 'HSR Layout', location: { lat: 12.9116, lng: 77.6389 } }
  const calls = fakeCore({
    ...signedIn,
    'POST /admin/stores': () => json(201, created),
    [`GET /admin/stores/${created.id}/service-areas`]: () => json(200, { pincodes: [] }),
    [`GET /admin/stores/${created.id}`]: () => json(200, created),
  })

  renderApp('/stores/new')
  await replace('Name', 'HSR Layout')
  await replace('Address', '27th Main, HSR Layout')
  await replace('Latitude', '12.9116')
  await replace('Longitude', '77.6389')
  await replace('Pincode', '560102')
  await replace('Promised minutes', '12')
  await userEvent.click(screen.getByRole('button', { name: 'Create store' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'HSR Layout' })).toBeInTheDocument()
  const post = calls.find((call) => call.method === 'POST')!
  expect(await post.json()).toMatchObject({ name: 'HSR Layout', location: { lat: 12.9116, lng: 77.6389 } })
  expect(screen.getByLabelText('Latitude')).toHaveValue('12.9116')
  expect(screen.getByLabelText('Longitude')).toHaveValue('77.6389')
})

test('the change form shows the location and sends it only when a coordinate changed', async () => {
  setToken('tok')
  const calls = keepsStore(located)

  renderApp(`/stores/${koramangala.id}`)
  expect(await screen.findByLabelText('Latitude')).toHaveValue('12.9352')
  expect(screen.getByLabelText('Longitude')).toHaveValue('77.6245')
  // The same number written longer is no change.
  await replace('Latitude', '12.93520')
  await replace('Promised minutes', '11')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText('Store saved.')
  await replace('Longitude', '77.625')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(2))

  const patches = calls.filter((call) => call.method === 'PATCH')
  expect(await patches[0].json()).toEqual({ promisedMinutes: 11 })
  expect(await patches[1].json()).toEqual({ location: { lat: 12.9352, lng: 77.625 } })
})
