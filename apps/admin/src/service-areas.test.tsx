import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, indiranagar, json, koramangala } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const areasPath = `/admin/stores/${koramangala.id}/service-areas`
const withStore = {
  'GET /admin/me': () => json(200, admin),
  [`GET /admin/stores/${koramangala.id}`]: () => json(200, koramangala),
  [`GET ${areasPath}`]: () => json(200, { pincodes: ['560034', '560095'] }),
}

function listed() {
  return within(screen.getByRole('table', { name: 'Pincodes' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('.tabular-nums')?.textContent)
}

async function addPincode(value: string) {
  await userEvent.type(screen.getByLabelText('Add pincode'), value)
  await userEvent.click(screen.getByRole('button', { name: 'Add' }))
}

test('the store page lists its pincodes', async () => {
  setToken('tok')
  fakeCore(withStore)

  renderApp(`/stores/${koramangala.id}`)

  expect(await screen.findByRole('heading', { level: 2, name: 'Delivery pincodes' })).toBeInTheDocument()
  await waitFor(() => expect(listed()).toEqual(['560034', '560095']))
  expect(screen.getByRole('button', { name: 'Save pincodes' })).toBeDisabled()
  expect(screen.queryByText('Unsaved changes.')).not.toBeInTheDocument()

  // The note and the button follow the difference from the saved list, not the fact of an edit.
  await userEvent.click(screen.getByRole('button', { name: 'Remove 560095' }))
  expect(screen.getByText('Unsaved changes.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save pincodes' })).toBeEnabled()
  await addPincode('560095')
  expect(listed()).toEqual(['560034', '560095'])
  expect(screen.queryByText('Unsaved changes.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save pincodes' })).toBeDisabled()
})

test('add and remove pincodes, then save the list with one PUT', async () => {
  setToken('tok')
  const calls = fakeCore({ ...withStore, [`PUT ${areasPath}`]: () => json(200, { pincodes: ['560034', '560047'] }) })

  renderApp(`/stores/${koramangala.id}`)
  await screen.findByRole('table', { name: 'Pincodes' })
  await addPincode('560047')
  await userEvent.click(screen.getByRole('button', { name: 'Remove 560095' }))
  expect(listed()).toEqual(['560034', '560047'])
  expect(screen.getByText('Unsaved changes.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Save pincodes' }))

  expect(await screen.findByText('Pincodes saved.')).toBeInTheDocument()
  expect(screen.queryByText('Unsaved changes.')).not.toBeInTheDocument()
  const puts = calls.filter((call) => call.method === 'PUT')
  expect(puts).toHaveLength(1)
  expect(await puts[0].json()).toEqual({ pincodes: ['560034', '560047'] })
  expect(listed()).toEqual(['560034', '560047'])
})

test('a pincode that is not 6 digits is not added', async () => {
  setToken('tok')
  fakeCore(withStore)

  renderApp(`/stores/${koramangala.id}`)
  await screen.findByRole('table', { name: 'Pincodes' })
  await addPincode('5600')

  expect(screen.getByLabelText('Add pincode')).toHaveAccessibleDescription('Enter a 6-digit pincode.')
  expect(listed()).toEqual(['560034', '560095'])
})

test('a pincode served by another store names that store', async () => {
  setToken('tok')
  fakeCore({
    ...withStore,
    [`PUT ${areasPath}`]: () =>
      json(409, { error: { code: 'conflict', message: 'pincode 560038 is served by another store', field: 'pincodes', pincode: '560038', storeId: indiranagar.id } }),
    [`GET /admin/stores/${indiranagar.id}`]: () => json(200, indiranagar),
  })

  renderApp(`/stores/${koramangala.id}`)
  await screen.findByRole('table', { name: 'Pincodes' })
  await addPincode('560038')
  await userEvent.click(screen.getByRole('button', { name: 'Save pincodes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Pincode 560038 is served by Indiranagar.')
  expect(screen.getByText('Unsaved changes.')).toBeInTheDocument()

  // The next edit clears the alert.
  await userEvent.click(screen.getByRole('button', { name: 'Remove 560038' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('the conflict shows the store id when its name cannot be read', async () => {
  setToken('tok')
  fakeCore({
    ...withStore,
    [`PUT ${areasPath}`]: () => json(409, { error: { code: 'conflict', message: 'x', field: 'pincodes', pincode: '560038', storeId: indiranagar.id } }),
    [`GET /admin/stores/${indiranagar.id}`]: () => apiError(500, 'internal'),
  })

  renderApp(`/stores/${koramangala.id}`)
  await screen.findByRole('table', { name: 'Pincodes' })
  await addPincode('560038')
  await userEvent.click(screen.getByRole('button', { name: 'Save pincodes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(`Pincode 560038 is served by ${indiranagar.id}.`)
})

test.each([
  ['an error answer', () => apiError(500, 'internal')],
  ['no answer', () => Promise.reject(new TypeError('Failed to fetch'))],
])('a pincode save failure with %s asks to try again', async (_name, answer) => {
  setToken('tok')
  fakeCore({ ...withStore, [`PUT ${areasPath}`]: answer })

  renderApp(`/stores/${koramangala.id}`)
  await screen.findByRole('table', { name: 'Pincodes' })
  await addPincode('560047')
  await userEvent.click(screen.getByRole('button', { name: 'Save pincodes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the pincodes. Try again.')
  expect(screen.getByText('Unsaved changes.')).toBeInTheDocument()
})
