import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, banana, categoryTree, dairy, fakeCore, fruits, json, productList, tonedMilk } from './fake-core'
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

test('after a delete the products table loads afresh', async () => {
  setToken('tok')
  let deleted = false
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = () => resolve()
  })
  fakeCore({
    ...withProduct,
    [`DELETE ${productPath}`]: () => {
      deleted = true
      return json(204)
    },
    // After the delete the list answers only when the test lets it, so a table kept from before would stay on screen.
    'GET /admin/products': async () => {
      if (!deleted) return productList([banana, tonedMilk])
      await held
      return productList([banana])
    },
  })

  renderApp('/products')
  await userEvent.click(await screen.findByRole('link', { name: 'Sunny Fields Toned Milk' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Delete product' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  release()
  expect(await screen.findByRole('link', { name: 'Banana Robusta' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Sunny Fields Toned Milk' })).not.toBeInTheDocument()
})

test('after deactivate instead the table and the product show it inactive', async () => {
  setToken('tok')
  let current = { ...tonedMilk }
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = () => resolve()
  })
  fakeCore({
    ...withProduct,
    [`GET ${productPath}`]: () => json(200, current),
    [`DELETE ${productPath}`]: () => apiError(409, 'conflict', 'product was ordered; set isActive to false instead'),
    [`PATCH ${productPath}`]: () => {
      current = { ...current, isActive: false }
      return json(200, current)
    },
    // Once the product is inactive the list answers only when the test lets it.
    'GET /admin/products': async () => {
      if (current.isActive) return productList([current])
      await held
      return productList([current])
    },
  })

  renderApp('/products')
  await userEvent.click(await screen.findByRole('link', { name: 'Sunny Fields Toned Milk' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Delete product' }))
  const dialog = screen.getByRole('dialog')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
  await userEvent.click(await within(dialog).findByRole('button', { name: 'Deactivate instead' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  release()
  const table = await screen.findByRole('table', { name: 'Products' })
  expect(within(table).getByText('Inactive')).toBeInTheDocument()

  // The product page has its own "Status" field; wait for the page before reading it (the list has a "Status" filter).
  await userEvent.click(within(table).getByRole('link', { name: 'Sunny Fields Toned Milk' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Sunny Fields Toned Milk' })).toBeInTheDocument()
  expect(screen.getByLabelText('Status')).toHaveValue('inactive')
})
