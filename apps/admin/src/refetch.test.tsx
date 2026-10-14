import { notifyManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { StockRow } from './stock'
import { clearToken, setToken } from './session'
import { admin, apiError, categoryTree, dairy, fakeCore, fruits, indiranagar, json, koramangala, productList, storeList, storeStaff, tonedMilk } from './fake-core'
import { renderApp } from './render-app'

type Answer = (request: Request) => Response | Promise<Response>
type Router = ReturnType<typeof renderApp>

// What core does to a read once the page shows: 'up' answers, 'down' is a proxy's bodiless 502 while core restarts,
// 'gone' is core's 404 for a row deleted elsewhere, 'forbidden' its 403.
let core: 'up' | 'down' | 'gone' | 'forbidden' = 'up'
const read = (answer: Answer): Answer => (request) =>
  core === 'up' ? answer(request) : core === 'down' ? json(502) : core === 'gone' ? apiError(404, 'not_found') : apiError(403, 'forbidden')

afterEach(() => {
  core = 'up'
  clearToken()
  vi.unstubAllGlobals()
})

const notice = 'Could not refresh. Showing what was loaded last.'
const stockRow: StockRow = { productId: tonedMilk.id, name: tonedMilk.name, unitLabel: '500 ml', priceCents: 2799, quantity: 17 }
const stockPath = `/admin/stores/${indiranagar.id}/stock`
const storePath = `/admin/stores/${koramangala.id}`
const productPath = `/admin/products/${tonedMilk.id}`

// Every read an admin page makes, each behind the switch; the session read always answers.
const routes: Record<string, Answer> = {
  'GET /admin/me': () => json(200, admin),
  'GET /admin/stores': read(() => storeList([indiranagar, koramangala])),
  [`GET ${storePath}`]: read(() => json(200, koramangala)),
  [`GET ${storePath}/service-areas`]: read(() => json(200, { pincodes: ['560034', '560095'] })),
  'GET /admin/categories': read(() => categoryTree([fruits, dairy])),
  'GET /admin/products': read(() => productList([tonedMilk])),
  [`GET ${productPath}`]: read(() => json(200, tonedMilk)),
  [`GET ${stockPath}`]: read(() => json(200, { items: [stockRow], page: 1, pageSize: 24, total: 1 })),
}

// Every read on screen is made again, as on a window focus. Resolves when all of them have answered and the pages have
// been told: TanStack Query tells them one turn later, and `schedule` queues behind that. Without it the assertions run
// against the page as it was before the answers and pass on any code.
const refetch = (router: Router) =>
  act(async () => {
    await router.options.context.queryClient.refetchQueries({ type: 'active' })
    await new Promise<void>((told) => notifyManager.schedule(told))
  })

// The page still shows, with the one notice and no alert; the next good answer takes the notice away.
async function keptThroughARefetch(router: Router, shown: () => void) {
  core = 'down'
  await refetch(router)
  shown()
  expect(screen.getAllByText(notice)).toHaveLength(1)
  expect(screen.getByText(notice)).toHaveAttribute('role', 'status')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  core = 'up'
  await refetch(router)
  shown()
  expect(screen.queryByText(notice)).not.toBeInTheDocument()
}

async function replace(label: string, value: string) {
  const field = await screen.findByLabelText(label)
  await userEvent.clear(field)
  await userEvent.type(field, value)
}

test.each([
  ['/stores', 'Stores', 'Koramangala'],
  ['/products', 'Products', 'Sunny Fields Toned Milk'],
  ['/categories', 'Categories', 'Dairy, Bread & Eggs'],
])('a failed refetch keeps the table of %s', async (path, caption, cell) => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp(path)
  await screen.findByRole('table', { name: caption })

  await keptThroughARefetch(router, () => expect(screen.getByRole('table', { name: caption })).toHaveTextContent(cell))
})

test('a failed refetch keeps the store page, what was typed in its form and the unsaved pincodes', async () => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp(`/stores/${koramangala.id}`)
  await replace('Name', 'Koramangala West')
  await screen.findByRole('table', { name: 'Pincodes' })
  await userEvent.type(screen.getByLabelText('Add pincode'), '560001')
  await userEvent.click(screen.getByRole('button', { name: 'Add' }))

  await keptThroughARefetch(router, () => {
    expect(screen.getByLabelText('Name')).toHaveValue('Koramangala West')
    expect(within(screen.getByRole('table', { name: 'Pincodes' })).getByText('560001')).toBeInTheDocument()
    expect(screen.getByText('Unsaved changes.')).toBeInTheDocument()
  })
})

test('a failed refetch keeps the product page and what was typed in its form', async () => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp(`/products/${tonedMilk.id}`)
  await replace('Name', 'Toned Milk 500')

  await keptThroughARefetch(router, () => {
    expect(screen.getByLabelText('Name')).toHaveValue('Toned Milk 500')
    expect(screen.getByLabelText('Category')).toHaveValue(tonedMilk.categoryId)
  })
})

test('a failed refetch keeps the new product form and what was typed in it', async () => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp('/products/new')
  await replace('Name', 'Curd Cup')

  await keptThroughARefetch(router, () => expect(screen.getByLabelText('Name')).toHaveValue('Curd Cup'))
})

test('a failed refetch keeps the stock table and the unsaved quantity', async () => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp('/stock')
  const field = await screen.findByRole('textbox', { name: `Quantity of ${stockRow.name}` })
  await userEvent.clear(field)
  await userEvent.type(field, '40')

  await keptThroughARefetch(router, () => {
    expect(screen.getByRole('textbox', { name: `Quantity of ${stockRow.name}` })).toHaveValue('40')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(screen.getByLabelText('Store')).toHaveValue(indiranagar.id)
  })
})

test('a failed refetch keeps the stock and the store name of store staff', async () => {
  setToken('tok')
  const own = `/admin/stores/${storeStaff.storeId}/stock`
  fakeCore({
    'GET /admin/me': () => json(200, storeStaff),
    [`GET ${own}`]: read(() => json(200, { items: [stockRow], page: 1, pageSize: 24, total: 1 })),
    [`GET /stores/${storeStaff.storeId}`]: read(() => json(200, { id: storeStaff.storeId, name: 'Indiranagar' })),
  })
  const router = renderApp('/stock')
  await screen.findByText('Indiranagar')

  await keptThroughARefetch(router, () => {
    expect(screen.getByRole('textbox', { name: `Quantity of ${stockRow.name}` })).toHaveValue('17')
    expect(screen.getByText('Indiranagar')).toBeInTheDocument()
  })
})

test('a save whose reload fails shows the saved quantity, "Stock saved." and the notice', async () => {
  setToken('tok')
  const calls = fakeCore({ ...routes, [`PUT ${stockPath}`]: () => { core = 'down'; return json(204) } })
  renderApp('/stock')
  const field = await screen.findByRole('textbox', { name: `Quantity of ${stockRow.name}` })
  await userEvent.clear(field)
  await userEvent.type(field, '40')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Stock saved.')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: `Quantity of ${stockRow.name}` })).toHaveValue('40')
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  expect(screen.getAllByText(notice)).toHaveLength(1)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(1)
})

test('a category save whose reload fails closes the dialog and keeps the table with the notice', async () => {
  setToken('tok')
  fakeCore({ ...routes, [`PATCH /admin/categories/${dairy.id}`]: () => { core = 'down'; return json(200, { ...dairy, name: 'Dairy' }) } })
  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: `Edit ${dairy.name}` }))
  await replace('Name', 'Dairy')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('table', { name: 'Categories' })).toBeInTheDocument()
  expect(screen.getAllByText(notice)).toHaveLength(1)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test.each([
  ['store', `/stores/${koramangala.id}`],
  ['product', `/products/${tonedMilk.id}`],
])('a %s deleted elsewhere shows not found on the next refetch, without the notice', async (_, path) => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp(path)
  await screen.findByLabelText('Name')

  core = 'gone'
  await refetch(router)

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(screen.queryByText(notice)).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
})

test('a 403 on a refetch shows not found, without the notice', async () => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp('/stores')
  await screen.findByRole('table', { name: 'Stores' })

  core = 'forbidden'
  await refetch(router)

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(screen.queryByText(notice)).not.toBeInTheDocument()
})

test.each([
  [`/stores/${koramangala.id}`, 'Could not load the store.', 'Name'],
  [`/products/${tonedMilk.id}`, 'Could not load the product.', 'Name'],
  ['/products/new', 'Could not load the categories.', 'Name'],
])('a first load of %s that fails shows the alert with "Try again" and no notice', async (path, message, label) => {
  setToken('tok')
  core = 'down'
  fakeCore(routes)
  renderApp(path)

  const alerts = await screen.findAllByRole('alert')
  expect(alerts[0]).toHaveTextContent(message)
  expect(screen.queryByText(notice)).not.toBeInTheDocument()
  expect(screen.queryByLabelText(label)).not.toBeInTheDocument()
  core = 'up'
  await userEvent.click(within(alerts[0]).getByRole('button', { name: 'Try again' }))
  expect(await screen.findByLabelText(label)).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
})

test('the pincodes failing on the first load show their own alert inside the store page, which stays', async () => {
  setToken('tok')
  let fail = true
  fakeCore({ ...routes, [`GET ${storePath}/service-areas`]: () => (fail ? json(502) : json(200, { pincodes: ['560034'] })) })
  renderApp(`/stores/${koramangala.id}`)

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not load the pincodes.')
  expect(screen.getByLabelText('Name')).toHaveValue('Koramangala')
  expect(screen.queryByText(notice)).not.toBeInTheDocument()
  fail = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('table', { name: 'Pincodes' })).toBeInTheDocument()
})

test('a page of stock that fails on its first load shows the alert and no notice, and the unsaved quantity is still counted', async () => {
  setToken('tok')
  const rows: StockRow[] = Array.from({ length: 30 }, (_, i) => ({ ...stockRow, productId: `00000000-0000-4000-8000-0000000007${String(i + 1).padStart(2, '0')}`, name: `Product ${String(i + 1).padStart(2, '0')}` }))
  fakeCore({
    ...routes,
    [`GET ${stockPath}`]: (request) => {
      const page = Number(new URL(request.url).searchParams.get('page') ?? 1)
      return page === 2 ? json(502) : json(200, { items: rows.slice(0, 24), page: 1, pageSize: 24, total: 30 })
    },
  })
  renderApp('/stock')
  const field = await screen.findByRole('textbox', { name: 'Quantity of Product 01' })
  await userEvent.clear(field)
  await userEvent.type(field, '40')
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the stock.')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  expect(screen.queryByText(notice)).not.toBeInTheDocument()
})

test('the notice leaves with the page it was about', async () => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp('/stores')
  await screen.findByRole('table', { name: 'Stores' })
  core = 'down'
  await refetch(router)
  expect(screen.getByText(notice)).toBeInTheDocument()

  core = 'up'
  await userEvent.click(screen.getByRole('link', { name: 'Categories' }))

  expect(await screen.findByRole('table', { name: 'Categories' })).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByText(notice)).not.toBeInTheDocument())
})
