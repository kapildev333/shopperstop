import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { components } from '@shopperstop/ui/api'
import { clearToken, setToken } from './session'
import { admin, apiError, categoryTree, dairy, fakeCore, fruits, json } from './fake-core'
import { renderApp } from './render-app'

type CategoryNode = components['schemas']['CategoryNode']

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const signedIn = { 'GET /admin/me': () => json(200, admin) }

function names() {
  return within(screen.getByRole('table', { name: 'Categories' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelectorAll('td')[1].textContent?.replace('Name', ''))
}

// A fake core that keeps the tree: POST adds, PATCH merges, DELETE removes; GET answers it ordered by sortOrder like core.
function keepsCategories() {
  let parents: CategoryNode[] = [fruits, dairy]
  const sorted = () => [...parents].sort((a, b) => a.sortOrder - b.sortOrder)
  return fakeCore({
    ...signedIn,
    'GET /admin/categories': () => categoryTree(sorted()),
    'POST /admin/categories': async (request) => {
      const body = await request.clone().json()
      const created = { id: '00000000-0000-4000-8000-000000000599', slug: 'curd', parentId: body.parentId, name: body.name, sortOrder: body.sortOrder }
      parents = parents.map((parent) => (parent.id === body.parentId ? { ...parent, children: [...parent.children, created] } : parent))
      return json(201, created)
    },
    [`PATCH /admin/categories/${dairy.id}`]: async (request) => {
      const body = await request.clone().json()
      parents = parents.map((parent) => (parent.id === dairy.id ? { ...parent, ...body } : parent))
      return json(200, { ...dairy, ...body, children: undefined })
    },
    [`DELETE /admin/categories/${dairy.children[0].id}`]: () => {
      parents = parents.map((parent) => (parent.id === dairy.id ? { ...parent, children: [] } : parent))
      return json(204)
    },
  })
}

test('the categories table lists parents, each followed by its children', async () => {
  setToken('tok')
  fakeCore({ ...signedIn, 'GET /admin/categories': () => categoryTree([fruits, dairy]) })

  renderApp('/categories')

  const table = await screen.findByRole('table', { name: 'Categories' })
  expect(names()).toEqual(['Fruits & Vegetables', 'Fresh Fruits', 'Dairy, Bread & Eggs', 'Milk'])
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows[0]).toHaveTextContent('Top level')
  expect(rows[0]).toHaveTextContent('10')
  expect(rows[3]).toHaveTextContent('Dairy, Bread & Eggs')
  expect(rows[0].querySelector('img')).toHaveAttribute('src', fruits.imageUrl)
  expect(rows[2].querySelector('img')).toBeNull()
  expect(within(rows[3]).getByRole('button', { name: 'Edit Milk' })).toBeInTheDocument()
  expect(within(rows[3]).getByRole('button', { name: 'Delete Milk' })).toBeInTheDocument()
})

test('no categories shows the empty state', async () => {
  setToken('tok')
  fakeCore({ ...signedIn, 'GET /admin/categories': () => categoryTree([]) })

  renderApp('/categories')

  expect(await screen.findByRole('heading', { level: 2, name: 'No categories yet' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'New category' })).toBeInTheDocument()
})

test('categories load failure shows a retry that reloads', async () => {
  setToken('tok')
  let fail = true
  fakeCore({ ...signedIn, 'GET /admin/categories': () => (fail ? apiError(500, 'internal') : categoryTree([dairy])) })

  renderApp('/categories')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not load the categories.')
  fail = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('table', { name: 'Categories' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('create a child category', async () => {
  setToken('tok')
  const calls = keepsCategories()

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'New category' }))
  const dialog = screen.getByRole('dialog', { name: 'New category' })
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Create category'])
  expect(within(dialog).getByLabelText('Sort order')).toHaveValue('0')
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Curd')
  await userEvent.selectOptions(within(dialog).getByLabelText('Parent'), dairy.id)
  await userEvent.clear(within(dialog).getByLabelText('Sort order'))
  await userEvent.type(within(dialog).getByLabelText('Sort order'), '20')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create category' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await calls.find((call) => call.method === 'POST')!.json()).toEqual({ name: 'Curd', sortOrder: 20, parentId: dairy.id })
  await waitFor(() => expect(names()).toEqual(['Fruits & Vegetables', 'Fresh Fruits', 'Dairy, Bread & Eggs', 'Milk', 'Curd']))
})

test('a change sends only the changed fields and reorders the tree', async () => {
  setToken('tok')
  const calls = keepsCategories()

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Dairy, Bread & Eggs' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit Dairy, Bread & Eggs' })
  expect(within(dialog).queryByLabelText('Parent')).not.toBeInTheDocument()
  await userEvent.clear(within(dialog).getByLabelText('Sort order'))
  await userEvent.type(within(dialog).getByLabelText('Sort order'), '5')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await calls.find((call) => call.method === 'PATCH')!.json()).toEqual({ sortOrder: 5 })
  await waitFor(() => expect(names()).toEqual(['Dairy, Bread & Eggs', 'Milk', 'Fruits & Vegetables', 'Fresh Fruits']))
})

test('a sort order the form cannot send is flagged without a request', async () => {
  setToken('tok')
  const calls = keepsCategories()

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Milk' }))
  const field = within(screen.getByRole('dialog')).getByLabelText('Sort order')
  await userEvent.clear(field)
  await userEvent.type(field, '-1')
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' }))

  expect(field).toHaveAccessibleDescription('Lower numbers come first. Enter a whole number from 0 to 9999.')
  expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
})

test('a validation error from core is shown on its field', async () => {
  setToken('tok')
  fakeCore({
    ...signedIn,
    'GET /admin/categories': () => categoryTree([fruits, dairy]),
    'POST /admin/categories': () => apiError(400, 'validation', 'categories have two levels', 'parentId'),
  })

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'New category' }))
  const dialog = screen.getByRole('dialog')
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Curd')
  await userEvent.selectOptions(within(dialog).getByLabelText('Parent'), dairy.id)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create category' }))

  await waitFor(() => expect(within(dialog).getByLabelText('Parent')).toHaveAccessibleDescription('Choose a top-level category.'))
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
})

test('any other category save error shows a banner', async () => {
  setToken('tok')
  fakeCore({
    ...signedIn,
    'GET /admin/categories': () => categoryTree([fruits, dairy]),
    [`PATCH /admin/categories/${dairy.id}`]: () => apiError(500, 'internal'),
  })

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Dairy, Bread & Eggs' }))
  await userEvent.type(within(screen.getByRole('dialog')).getByLabelText('Name'), ' Co')
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' }))

  expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Could not save the category. Try again.')
})

test('delete asks first, then removes the category', async () => {
  setToken('tok')
  const calls = keepsCategories()

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Milk' }))
  const dialog = screen.getByRole('dialog', { name: 'Delete Milk?' })
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Delete'])
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Delete Milk' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

  await waitFor(() => expect(names()).toEqual(['Fruits & Vegetables', 'Fresh Fruits', 'Dairy, Bread & Eggs']))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(1)
})

test('a category in use cannot be deleted', async () => {
  setToken('tok')
  const calls = fakeCore({
    ...signedIn,
    'GET /admin/categories': () => categoryTree([fruits, dairy]),
    [`DELETE /admin/categories/${dairy.id}`]: () => apiError(409, 'conflict', 'category has products or subcategories'),
  })

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Dairy, Bread & Eggs' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

  const dialog = screen.getByRole('dialog', { name: 'Delete Dairy, Bread & Eggs?' })
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'This category still has subcategories or products. Move or delete them first.',
  )
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Delete'])
  expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(1)
  expect(names()).toContain('Dairy, Bread & Eggs')
})

test('create a top-level category sends no parent', async () => {
  setToken('tok')
  const calls = keepsCategories()

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'New category' }))
  const dialog = screen.getByRole('dialog', { name: 'New category' })
  expect(within(dialog).getByLabelText('Parent')).toHaveValue('')
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Snacks')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create category' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await calls.find((call) => call.method === 'POST')!.json()).toEqual({ name: 'Snacks', sortOrder: 0 })
})

test('a field error from core clears when its field is edited', async () => {
  setToken('tok')
  fakeCore({
    ...signedIn,
    'GET /admin/categories': () => categoryTree([fruits, dairy]),
    'POST /admin/categories': () => apiError(400, 'validation', 'must be between 0 and 9999', 'sortOrder'),
  })

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'New category' }))
  const dialog = screen.getByRole('dialog')
  const field = within(dialog).getByLabelText('Sort order')
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Curd')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create category' }))
  await waitFor(() => expect(field).toHaveAccessibleDescription('Lower numbers come first. Enter a whole number from 0 to 9999.'))
  await userEvent.type(field, '5')

  expect(field).toHaveAccessibleDescription('Lower numbers come first.')
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
})

test('a sort order error clears when the field is edited', async () => {
  setToken('tok')
  keepsCategories()

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Milk' }))
  const field = within(screen.getByRole('dialog')).getByLabelText('Sort order')
  await userEvent.clear(field)
  await userEvent.type(field, '-1')
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' }))
  expect(field).toHaveAccessibleDescription('Lower numbers come first. Enter a whole number from 0 to 9999.')
  await userEvent.clear(field)

  expect(field).toHaveAccessibleDescription('Lower numbers come first.')
})
