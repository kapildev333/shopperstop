import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { StockRow } from './stock'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, indiranagar, json, koramangala, storeList, storeStaff } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const banana: StockRow = { productId: '00000000-0000-4000-8000-000000000601', name: 'Banana Robusta', unitLabel: '1 kg', priceCents: 7000, quantity: 0 }
const bread: StockRow = { productId: '00000000-0000-4000-8000-000000000620', name: 'Brown Bread', unitLabel: '400 g', priceCents: 4500, quantity: 5 }
const curd: StockRow = { productId: '00000000-0000-4000-8000-000000000630', name: 'Fresh Curd', unitLabel: '400 g', priceCents: 3550, quantity: 4 }
const milk: StockRow = { productId: '00000000-0000-4000-8000-000000000612', name: 'Sunny Fields Toned Milk', brand: 'Sunny Fields', unitLabel: '500 ml', priceCents: 2799, quantity: 17 }
// Thirty products, "Product 01" to "Product 30", holding 0 to 29: two pages of 24, the first five low.
const thirty: StockRow[] = Array.from({ length: 30 }, (_, i) => ({
  productId: `00000000-0000-4000-8000-0000000007${String(i + 1).padStart(2, '0')}`,
  name: `Product ${String(i + 1).padStart(2, '0')}`,
  unitLabel: '1 unit',
  priceCents: 1000,
  quantity: i,
}))

const asAdmin = { 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([indiranagar, koramangala]) }

// One store's stock as core serves it: q on name or brand, lowStock below 5, pages of 24, and a PUT that sets quantities.
// `puts` holds every PUT body; `hold` makes the GETs wait until `release()`.
function stockCore(storeId: string, rows: StockRow[]) {
  const held = rows.map((row) => ({ ...row }))
  const puts: unknown[] = []
  let gate = Promise.resolve()
  let release = () => {}
  return {
    puts,
    hold: () => {
      gate = new Promise<void>((resolve) => (release = resolve))
    },
    release: () => release(),
    routes: {
      [`GET /admin/stores/${storeId}/stock`]: async (request: Request) => {
        await gate
        const query = new URL(request.url).searchParams
        const q = (query.get('q') ?? '').toLowerCase()
        const page = Number(query.get('page') ?? 1)
        const match = held.filter(
          (row) => `${row.name} ${row.brand ?? ''}`.toLowerCase().includes(q) && (query.get('lowStock') !== 'true' || row.quantity < 5),
        )
        return json(200, { items: match.slice((page - 1) * 24, page * 24), page, pageSize: 24, total: match.length })
      },
      [`PUT /admin/stores/${storeId}/stock`]: async (request: Request) => {
        const body = (await request.json()) as { rows: { productId: string; quantity: number }[] }
        puts.push(body)
        for (const { productId, quantity } of body.rows) held.find((row) => row.productId === productId)!.quantity = quantity
        return json(204)
      },
    },
  }
}

// The query of the last stock list request.
function lastListQuery(calls: Request[]) {
  const list = calls.filter((call) => call.method === 'GET' && new URL(call.url).pathname.endsWith('/stock'))
  return Object.fromEntries(new URL(list[list.length - 1].url).searchParams)
}

const quantity = (name: string) => screen.getByRole('textbox', { name: `Quantity of ${name}` })
const findQuantity = (name: string) => screen.findByRole('textbox', { name: `Quantity of ${name}` })

test('the stock table lists a page of the first store and badges quantities below 5', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [banana, bread, curd, milk]).routes })

  renderApp('/stock')

  const table = await screen.findByRole('table', { name: 'Stock' })
  const rows = within(table).getAllByRole('row').slice(1)
  expect(within(table).getAllByRole('textbox').map((input) => input.getAttribute('aria-label'))).toEqual([
    'Quantity of Banana Robusta',
    'Quantity of Brown Bread',
    'Quantity of Fresh Curd',
    'Quantity of Sunny Fields Toned Milk',
  ])
  expect(rows[3]).toHaveTextContent('Sunny Fields Toned Milk')
  expect(within(rows[3]).getByText('Sunny Fields')).toBeInTheDocument()
  expect(rows[3]).toHaveTextContent('500 ml')
  expect(rows[3]).toHaveTextContent('₹27.99')
  expect(quantity('Sunny Fields Toned Milk')).toHaveValue('17')
  expect(quantity('Banana Robusta')).toHaveValue('0')
  expect(within(rows[0]).getByText('Low stock')).toBeInTheDocument()
  expect(within(rows[2]).getByText('Low stock')).toBeInTheDocument()
  expect(within(rows[1]).queryByText('Low stock')).not.toBeInTheDocument()
  expect(within(rows[3]).queryByText('Low stock')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(indiranagar.id)
  expect(within(screen.getByLabelText('Store')).getAllByRole('option').map((option) => option.textContent)).toEqual(['Indiranagar', 'Koramangala'])
  expect(screen.getByText('Page 1 of 1, 4 products')).toBeInTheDocument()
  expect(new URL(calls[calls.length - 1].url).pathname).toBe(`/api/core/v1/admin/stores/${indiranagar.id}/stock`)
  expect(lastListQuery(calls)).toEqual({ page: '1', pageSize: '24' })
})

test('store staff see their own store and no store selector', async () => {
  setToken('tok')
  const calls = fakeCore({ 'GET /admin/me': () => json(200, storeStaff), ...stockCore(storeStaff.storeId!, [milk]).routes })

  renderApp(`/stock?store=${koramangala.id}`)

  expect(await findQuantity('Sunny Fields Toned Milk')).toHaveValue('17')
  expect(screen.queryByLabelText('Store')).not.toBeInTheDocument()
  expect(calls.map((call) => new URL(call.url).pathname.replace('/api/core/v1', ''))).toEqual(['/admin/me', `/admin/stores/${storeStaff.storeId}/stock`])
})

test('choosing a store puts it in the URL and loads its stock, never under the other store\'s rows', async () => {
  setToken('tok')
  const other = stockCore(koramangala.id, [milk])
  fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [banana]).routes, ...other.routes })

  const router = renderApp('/stock')
  await findQuantity('Banana Robusta')
  other.hold()
  await userEvent.selectOptions(screen.getByLabelText('Store'), koramangala.id)

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Quantity of Banana Robusta' })).not.toBeInTheDocument()
  other.release()
  expect(await findQuantity('Sunny Fields Toned Milk')).toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(koramangala.id)
  expect(screen.getByLabelText('Store')).toHaveFocus()
  expect(router.state.location.search).toEqual({ store: koramangala.id })
})

test('a store in the URL is the one shown', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [banana]).routes, ...stockCore(koramangala.id, [milk]).routes })

  renderApp(`/stock?store=${koramangala.id}`)

  expect(await findQuantity('Sunny Fields Toned Milk')).toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(koramangala.id)
})

test('a store in the URL that is not a store shows the first store', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [banana]).routes })

  renderApp('/stock?store=00000000-0000-4000-8000-000000000499')

  expect(await findQuantity('Banana Robusta')).toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(indiranagar.id)
})

test('search and the low-stock filter ask core again from the first page', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [...thirty, milk]).routes })

  const router = renderApp('/stock')
  await userEvent.click(await screen.findByRole('button', { name: 'Next' }))
  await waitFor(() => expect(lastListQuery(calls).page).toBe('2'))

  await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), ' product ')
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(lastListQuery(calls)).toEqual({ q: 'product', page: '1', pageSize: '24' }))
  expect(await screen.findByText('Page 1 of 2, 30 products')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() => expect(lastListQuery(calls).page).toBe('2'))
  const chip = screen.getByRole('button', { name: 'Low stock only' })
  expect(chip).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(chip)
  await waitFor(() => expect(lastListQuery(calls)).toEqual({ q: 'product', lowStock: 'true', page: '1', pageSize: '24' }))
  expect(await screen.findByText('Page 1 of 1, 5 products')).toBeInTheDocument()
  expect(chip).toHaveAttribute('aria-pressed', 'true')
  expect(chip).toHaveFocus()
  expect(router.state.location.search).toEqual({ q: 'product', lowStock: true })

  await userEvent.click(chip)
  await waitFor(() => expect(lastListQuery(calls)).toEqual({ q: 'product', page: '1', pageSize: '24' }))
})

test('the pager moves between pages and the pressed button keeps focus', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, thirty).routes })

  const router = renderApp('/stock')
  expect(await screen.findByText('Page 1 of 2, 30 products')).toBeInTheDocument()
  const next = screen.getByRole('button', { name: 'Next' })
  expect(screen.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'true')
  expect(next).toHaveAttribute('aria-disabled', 'false')
  await userEvent.click(next)

  expect(await screen.findByText('Page 2 of 2, 30 products')).toBeInTheDocument()
  expect(await findQuantity('Product 25')).toHaveValue('24')
  expect(screen.queryByRole('textbox', { name: 'Quantity of Product 01' })).not.toBeInTheDocument()
  expect(lastListQuery(calls).page).toBe('2')
  expect(next).toHaveAttribute('aria-disabled', 'true')
  expect(next).not.toBeDisabled()
  expect(next).toHaveFocus()
  const requests = calls.length
  await userEvent.click(next)
  expect(router.state.location.search).toEqual({ page: 2 })
  expect(calls).toHaveLength(requests)

  await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
  expect(await screen.findByText('Page 1 of 2, 30 products')).toBeInTheDocument()
  expect(await findQuantity('Product 01')).toBeInTheDocument()
  expect(router.state.location.search).toEqual({})
  expect(screen.getByRole('button', { name: 'Previous' })).toHaveFocus()
})

test('a page past the end shows the last page', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, thirty).routes })

  const router = renderApp('/stock?page=9')

  expect(await screen.findByText('Page 2 of 2, 30 products')).toBeInTheDocument()
  expect(await findQuantity('Product 25')).toBeInTheDocument()
  expect(router.state.location.search).toEqual({ page: 2 })
})

test('a search that matches nothing shows the empty state', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [milk]).routes })

  renderApp('/stock?q=ghee')

  expect(await screen.findByRole('heading', { level: 2, name: 'No products found' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('ghee')
  expect(lastListQuery(calls).q).toBe('ghee')
})

test('the stock table shows a skeleton while loading', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, [`GET /admin/stores/${indiranagar.id}/stock`]: () => new Promise<Response>(() => {}) })

  renderApp('/stock')

  expect(await screen.findByLabelText('Store')).toBeInTheDocument()
  expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Stock' })).toBeInTheDocument()
})

test('stock load failure shows a retry that reloads', async () => {
  setToken('tok')
  let fail = true
  const core = stockCore(indiranagar.id, [milk])
  const path = `GET /admin/stores/${indiranagar.id}/stock`
  fakeCore({ ...asAdmin, [path]: (request) => (fail ? apiError(500, 'internal') : core.routes[path](request)) })

  renderApp('/stock')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not load the stock.')
  fail = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
  expect(await findQuantity('Sunny Fields Toned Milk')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('an admin with no stores is told to create one', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([]) })

  renderApp('/stock')

  expect(await screen.findByRole('heading', { level: 2, name: 'No stores yet' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Store')).not.toBeInTheDocument()
})

test('stores load failure shows a retry that reloads', async () => {
  setToken('tok')
  let fail = true
  fakeCore({
    'GET /admin/me': () => json(200, admin),
    'GET /admin/stores': () => (fail ? apiError(500, 'internal') : storeList([indiranagar])),
    ...stockCore(indiranagar.id, [milk]).routes,
  })

  renderApp('/stock')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not load the stores.')
  fail = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
  expect(await findQuantity('Sunny Fields Toned Milk')).toBeInTheDocument()
})
