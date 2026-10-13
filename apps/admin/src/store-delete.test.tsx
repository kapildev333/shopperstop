import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, json, koramangala, storeList } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const storePath = `/admin/stores/${koramangala.id}`
const withStore = {
  'GET /admin/me': () => json(200, admin),
  [`GET ${storePath}`]: () => json(200, koramangala),
  [`GET ${storePath}/service-areas`]: () => json(200, { pincodes: ['560034', '560095'] }),
}

test('delete asks first, then removes the store', async () => {
  setToken('tok')
  const calls = fakeCore({
    ...withStore,
    [`DELETE ${storePath}`]: () => new Response(null, { status: 204 }),
    'GET /admin/stores': () => storeList([]),
  })

  const router = renderApp(`/stores/${koramangala.id}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete store' }))
  const dialog = screen.getByRole('dialog', { name: 'Delete Koramangala?' })
  const buttons = within(dialog).getAllByRole('button').map((button) => button.textContent)
  expect(buttons).toEqual(['Cancel', 'Delete'])
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(0)

  await userEvent.click(screen.getByRole('button', { name: 'Delete store' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/stores'))
  expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(1)
  expect(await screen.findByRole('heading', { level: 2, name: 'No stores yet' })).toBeInTheDocument()
})

test('a store in use cannot be deleted', async () => {
  setToken('tok')
  fakeCore({ ...withStore, [`DELETE ${storePath}`]: () => apiError(409, 'conflict', 'still in use') })

  const router = renderApp(`/stores/${koramangala.id}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete store' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

  expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(
    'This store still has staff users or orders. Remove its staff users first; a store with orders cannot be deleted.',
  )
  expect(router.state.location.pathname).toBe(`/stores/${koramangala.id}`)
})
