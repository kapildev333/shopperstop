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

const signedIn = { 'GET /admin/me': () => json(200, admin), 'GET /admin/categories': () => categoryTree([fruits, dairy]) }

// The query of the last product list request.
function lastListQuery(calls: Request[]) {
  const list = calls.filter((call) => new URL(call.url).pathname.endsWith('/admin/products'))
  return Object.fromEntries(new URL(list[list.length - 1].url).searchParams)
}

test('products table lists a page of products', async () => {
  setToken('tok')
  const calls = fakeCore({ ...signedIn, 'GET /admin/products': () => productList([banana, tonedMilk]) })

  renderApp('/products')

  const table = await screen.findByRole('table', { name: 'Products' })
  const rows = within(table).getAllByRole('row').slice(1)
  expect(within(table).getAllByRole('link').map((link) => link.textContent)).toEqual(['Banana Robusta', 'Sunny Fields Toned Milk'])
  expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', `/products/${tonedMilk.id}`)
  expect(rows[1]).toHaveTextContent('Sunny Fields')
  await waitFor(() => expect(rows[1]).toHaveTextContent('Dairy, Bread & Eggs › Milk'))
  expect(rows[1]).toHaveTextContent('500 ml')
  expect(rows[1]).toHaveTextContent('₹27.99')
  expect(rows[1]).toHaveTextContent('MRP ₹30')
  expect(within(rows[1]).getByText('Active')).toBeInTheDocument()
  expect(within(rows[0]).getByText('Inactive')).toBeInTheDocument()
  expect(rows[0]).toHaveTextContent('Fruits & Vegetables › Fresh Fruits')
  expect(screen.getByText('Page 1 of 1, 2 products')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'New product' })).toHaveAttribute('href', '/products/new')
  expect(lastListQuery(calls)).toEqual({ page: '1', pageSize: '24' })
})

test('search and filters ask core again from the first page', async () => {
  setToken('tok')
  const calls = fakeCore({ ...signedIn, 'GET /admin/products': () => productList([tonedMilk], 30) })

  renderApp('/products')
  await screen.findByRole('table', { name: 'Products' })
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() => expect(lastListQuery(calls).page).toBe('2'))

  await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), ' milk ')
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(lastListQuery(calls)).toEqual({ q: 'milk', page: '1', pageSize: '24' }))

  await userEvent.selectOptions(screen.getByLabelText('Category'), dairy.children[0].id)
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'Inactive')
  await waitFor(() =>
    expect(lastListQuery(calls)).toEqual({ q: 'milk', categoryId: dairy.children[0].id, isActive: 'false', page: '1', pageSize: '24' }),
  )
})

test('the pager moves between pages', async () => {
  setToken('tok')
  const calls = fakeCore({
    ...signedIn,
    'GET /admin/products': (request) =>
      new URL(request.url).searchParams.get('page') === '2' ? productList([tonedMilk], 30, 2) : productList([banana], 30),
  })

  renderApp('/products')
  expect(await screen.findByText('Page 1 of 2, 30 products')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))

  expect(await screen.findByText('Page 2 of 2, 30 products')).toBeInTheDocument()
  expect(await screen.findByRole('link', { name: 'Sunny Fields Toned Milk' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  expect(lastListQuery(calls).page).toBe('2')
  await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
  expect(await screen.findByText('Page 1 of 2, 30 products')).toBeInTheDocument()
})

test('no products shows the empty state', async () => {
  setToken('tok')
  fakeCore({ ...signedIn, 'GET /admin/products': () => productList([]) })

  renderApp('/products')

  expect(await screen.findByRole('heading', { level: 2, name: 'No products found' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'New product' })).toBeInTheDocument()
})

test('products table shows a skeleton while loading', async () => {
  setToken('tok')
  fakeCore({ ...signedIn, 'GET /admin/products': () => new Promise<Response>(() => {}) })

  renderApp('/products')

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument()
})

test('products load failure shows a retry that reloads', async () => {
  setToken('tok')
  let fail = true
  fakeCore({ ...signedIn, 'GET /admin/products': () => (fail ? apiError(500, 'internal') : productList([banana])) })

  renderApp('/products')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not load the products.')
  fail = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('link', { name: 'Banana Robusta' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
