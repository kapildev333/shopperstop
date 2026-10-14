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
const milk = dairy.children[0]
const signedIn = { 'GET /admin/me': () => json(200, admin), 'GET /admin/categories': () => categoryTree([fruits, dairy]) }
const withProduct = { ...signedIn, [`GET ${productPath}`]: () => json(200, tonedMilk) }

async function replace(label: string, value: string) {
  const field = await screen.findByLabelText(label)
  await userEvent.clear(field)
  if (value) await userEvent.type(field, value)
}

test('create a product and open it', async () => {
  setToken('tok')
  const created = { ...tonedMilk, id: '00000000-0000-4000-8000-000000000699', name: 'Curd Cup', brand: undefined }
  const calls = fakeCore({
    ...signedIn,
    'POST /admin/products': () => json(201, created),
    // The new product's page refetches it on mount (staleTime 0); without this answer it shows not found.
    [`GET /admin/products/${created.id}`]: () => json(200, created),
  })

  const router = renderApp('/products/new')
  expect(await screen.findByRole('heading', { level: 1, name: 'New product' })).toBeInTheDocument()
  expect(await screen.findByLabelText('Status')).toHaveValue('active')
  await replace('Name', 'Curd Cup')
  await userEvent.selectOptions(screen.getByLabelText('Category'), milk.id)
  await replace('Unit', '400 g')
  await replace('MRP (₹)', '40')
  await replace('Price (₹)', '35.50')
  await userEvent.click(screen.getByRole('button', { name: 'Create product' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Curd Cup' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(`/products/${created.id}`)
  expect(await calls.find((call) => call.method === 'POST')!.json()).toEqual({
    name: 'Curd Cup',
    brand: '',
    categoryId: milk.id,
    unitLabel: '400 g',
    mrpCents: 4000,
    priceCents: 3550,
    description: '',
    isActive: true,
  })
})

test('edit sends only the changed fields and confirms', async () => {
  setToken('tok')
  const calls = fakeCore({
    ...withProduct,
    [`PATCH ${productPath}`]: () => json(200, { ...tonedMilk, brand: undefined, priceCents: 2800 }),
  })

  renderApp(`/products/${tonedMilk.id}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Sunny Fields Toned Milk' })).toBeInTheDocument()
  expect(screen.getByLabelText('MRP (₹)')).toHaveValue('30')
  expect(screen.getByLabelText('Price (₹)')).toHaveValue('27.99')
  expect(screen.getByLabelText('Category')).toHaveValue(milk.id)
  await replace('Price (₹)', '28')
  await replace('Brand', '')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Product saved.')).toBeInTheDocument()
  expect(await calls.find((call) => call.method === 'PATCH')!.json()).toEqual({ brand: '', priceCents: 2800 })
  expect(screen.getByLabelText('Price (₹)')).toHaveValue('28')
})

test('a value the form cannot send is flagged without a request', async () => {
  setToken('tok')
  const calls = fakeCore(withProduct)

  renderApp(`/products/${tonedMilk.id}`)
  await replace('MRP (₹)', '30.555')
  await replace('Price (₹)', '')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(screen.getByLabelText('MRP (₹)')).toHaveAccessibleDescription('Enter 0.01 to 1000000 rupees, at most two decimals.')
  expect(screen.getByLabelText('Price (₹)')).toHaveAccessibleDescription(
    'At most the MRP. Enter a price from 0.01 rupees up to the MRP, at most two decimals.',
  )
  expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
})

test('a validation error from core is shown on its field', async () => {
  setToken('tok')
  fakeCore({ ...withProduct, [`PATCH ${productPath}`]: () => apiError(400, 'validation', 'must be between 1 and mrpCents', 'priceCents') })

  renderApp(`/products/${tonedMilk.id}`)
  await replace('Price (₹)', '31')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() =>
    expect(screen.getByLabelText('Price (₹)')).toHaveAccessibleDescription(
      'At most the MRP. Enter a price from 0.01 rupees up to the MRP, at most two decimals.',
    ),
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText('Product saved.')).not.toBeInTheDocument()
})

test('any other product save error shows a banner', async () => {
  setToken('tok')
  fakeCore({ ...withProduct, [`PATCH ${productPath}`]: () => apiError(500, 'internal') })

  renderApp(`/products/${tonedMilk.id}`)
  await replace('Price (₹)', '28')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the product. Try again.')
})

test('an unknown product shows not found', async () => {
  setToken('tok')
  fakeCore(signedIn)

  const router = renderApp('/products/00000000-0000-4000-8000-000000000000')

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/products/00000000-0000-4000-8000-000000000000')
  const nav = screen.getByRole('navigation', { name: 'Admin' })
  expect(within(nav).getByRole('link', { name: 'Products' })).toHaveAttribute('aria-current', 'page')
})

// A fake core that keeps the product: PATCH merges the body, GETs answer the current values.
function keepsProduct() {
  let current = { ...tonedMilk }
  return fakeCore({
    ...signedIn,
    'GET /admin/products': () => productList([current]),
    [`GET ${productPath}`]: () => json(200, current),
    [`PATCH ${productPath}`]: async (request) => {
      current = { ...current, ...(await request.clone().json()) }
      // Core trims text.
      current.name = current.name.trim()
      return json(200, current)
    },
  })
}

test('a second product save sends only its own change', async () => {
  setToken('tok')
  const calls = keepsProduct()

  renderApp(`/products/${tonedMilk.id}`)
  await replace('Price (₹)', '28')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText('Product saved.')
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'inactive')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await screen.findByText('Product saved.')
  const patches = calls.filter((call) => call.method === 'PATCH')
  expect(patches).toHaveLength(2)
  expect(await patches[1].json()).toEqual({ isActive: false })
})

test('the products table shows a saved change', async () => {
  setToken('tok')
  keepsProduct()

  renderApp('/products')
  await userEvent.click(await screen.findByRole('link', { name: 'Sunny Fields Toned Milk' }))
  await replace('Price (₹)', '28')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText('Product saved.')
  await userEvent.click(within(screen.getByRole('navigation', { name: 'Admin' })).getByRole('link', { name: 'Products' }))

  expect(await within(await screen.findByRole('table', { name: 'Products' })).findByText('₹28')).toBeInTheDocument()
})

test('a failing create shows a banner and stays on the new page', async () => {
  setToken('tok')
  fakeCore({ ...signedIn, 'POST /admin/products': () => apiError(500, 'internal') })

  const router = renderApp('/products/new')
  await replace('Name', 'Curd Cup')
  await userEvent.selectOptions(screen.getByLabelText('Category'), milk.id)
  await replace('Unit', '400 g')
  await replace('MRP (₹)', '40')
  await replace('Price (₹)', '35.50')
  await userEvent.click(screen.getByRole('button', { name: 'Create product' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the product. Try again.')
  expect(router.state.location.pathname).toBe('/products/new')
  expect(screen.getByRole('heading', { level: 1, name: 'New product' })).toBeInTheDocument()
})

test('after a save the form shows the product as core stored it', async () => {
  setToken('tok')
  const calls = keepsProduct()

  renderApp(`/products/${tonedMilk.id}`)
  await replace('Name', '  Toned Milk  ')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText('Product saved.')
  expect(screen.getByLabelText('Name')).toHaveValue('Toned Milk')
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'inactive')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await screen.findByText('Product saved.')
  const patches = calls.filter((call) => call.method === 'PATCH')
  expect(patches).toHaveLength(2)
  expect(await patches[0].json()).toEqual({ name: '  Toned Milk  ' })
  expect(await patches[1].json()).toEqual({ isActive: false })
})

test('an amount error clears when its field is edited', async () => {
  setToken('tok')
  fakeCore(withProduct)

  renderApp(`/products/${tonedMilk.id}`)
  await replace('MRP (₹)', '30.555')
  await replace('Price (₹)', '')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(screen.getByLabelText('Price (₹)')).toHaveAccessibleDescription(
    'At most the MRP. Enter a price from 0.01 rupees up to the MRP, at most two decimals.',
  )
  await userEvent.type(screen.getByLabelText('Price (₹)'), '28')

  expect(screen.getByLabelText('Price (₹)')).toHaveAccessibleDescription('At most the MRP.')
  expect(screen.getByLabelText('MRP (₹)')).toHaveAccessibleDescription('Enter 0.01 to 1000000 rupees, at most two decimals.')
})
