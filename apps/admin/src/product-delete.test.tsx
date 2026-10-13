import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, categoryTree, dairy, fakeCore, fruits, json, productList, tonedMilk } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const productPath = `/admin/products/${tonedMilk.id}`
const withProduct = {
  'GET /admin/me': () => json(200, admin),
  'GET /admin/categories': () => categoryTree([fruits, dairy]),
  [`GET ${productPath}`]: () => json(200, tonedMilk),
}

test('delete asks first, then removes the product', async () => {
  setToken('tok')
  const calls = fakeCore({ ...withProduct, [`DELETE ${productPath}`]: () => json(204), 'GET /admin/products': () => productList([]) })

  const router = renderApp(`/products/${tonedMilk.id}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete product' }))
  const dialog = screen.getByRole('dialog', { name: 'Delete Sunny Fields Toned Milk?' })
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Delete'])
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(0)

  await userEvent.click(screen.getByRole('button', { name: 'Delete product' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/products'))
  expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(1)
  expect(await screen.findByRole('heading', { level: 2, name: 'No products found' })).toBeInTheDocument()
})

test('an ordered product offers to deactivate instead', async () => {
  setToken('tok')
  const calls = fakeCore({
    ...withProduct,
    [`DELETE ${productPath}`]: () => apiError(409, 'conflict', 'product was ordered; set isActive to false instead'),
    [`PATCH ${productPath}`]: () => json(200, { ...tonedMilk, isActive: false }),
    'GET /admin/products': () => productList([{ ...tonedMilk, isActive: false }]),
  })

  const router = renderApp(`/products/${tonedMilk.id}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete product' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

  const dialog = screen.getByRole('dialog')
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'This product was ordered, so it cannot be deleted. Deactivate it instead: customers no longer see it.',
  )
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Deactivate instead'])
  await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate instead' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/products'))
  expect(await calls.find((call) => call.method === 'PATCH')!.json()).toEqual({ isActive: false })
  const table = await screen.findByRole('table', { name: 'Products' })
  expect(within(table).getByText('Inactive')).toBeInTheDocument()
})

test('any other delete failure shows a banner in the dialog', async () => {
  setToken('tok')
  fakeCore({ ...withProduct, [`DELETE ${productPath}`]: () => apiError(500, 'internal') })

  const router = renderApp(`/products/${tonedMilk.id}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete product' }))
  const dialog = screen.getByRole('dialog')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not delete the product. Try again.')
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Delete'])
  expect(router.state.location.pathname).toBe(`/products/${tonedMilk.id}`)
})
