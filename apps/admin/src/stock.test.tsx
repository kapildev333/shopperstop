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

test('store staff see their own store by name and no store selector', async () => {
  setToken('tok')
  const own = { ...koramangala, id: storeStaff.storeId!, name: 'Whitefield' }
  const calls = fakeCore({
    'GET /admin/me': () => json(200, storeStaff),
    [`GET /stores/${own.id}`]: () => json(200, { id: own.id, name: own.name, isOpen: true, deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900, promisedMinutes: 10 }),
    ...stockCore(own.id, [milk]).routes,
  })

  renderApp(`/stock?store=${koramangala.id}`)

  expect(await findQuantity('Sunny Fields Toned Milk')).toHaveValue('17')
  expect(await screen.findByText('Whitefield')).toBeInTheDocument()
  expect(screen.queryByLabelText('Store')).not.toBeInTheDocument()
  expect(calls.map((call) => new URL(call.url).pathname.replace('/api/core/v1', '')).sort()).toEqual(['/admin/me', `/admin/stores/${own.id}/stock`, `/stores/${own.id}`])
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

// Replaces what a quantity field holds, as a user selecting it and typing would.
async function type(name: string, value: string) {
  await userEvent.clear(quantity(name))
  if (value) await userEvent.type(quantity(name), value)
}

test('edits made on two pages and under a filter are saved with one PUT', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, thirty)
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/stock')
  await findQuantity('Product 01')
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  await type('Product 01', '40')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  expect(within(quantity('Product 01').closest('tr')!).getByText('Unsaved')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await findQuantity('Product 25')
  await type('Product 25', '7')
  expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Low stock only' }))
  expect(await screen.findByText('Page 1 of 1, 5 products')).toBeInTheDocument()
  expect(quantity('Product 01')).toHaveValue('40')
  expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Stock saved.')).toBeInTheDocument()
  expect(core.puts).toEqual([{ rows: [{ productId: thirty[0].productId, quantity: 40 }, { productId: thirty[24].productId, quantity: 7 }] }])
  expect(calls.filter((call) => call.method === 'PUT').map((call) => new URL(call.url).pathname)).toEqual([`/api/core/v1/admin/stores/${indiranagar.id}/stock`])
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  expect(screen.getByText('Page 1 of 1, 4 products')).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Quantity of Product 01' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Low stock only' }))
  expect(await findQuantity('Product 01')).toHaveValue('40')
  expect(screen.queryByText('Unsaved')).not.toBeInTheDocument()
})

test('a page kept from before a save is read again, never shown with the old quantity', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, thirty)
  fakeCore({ ...asAdmin, ...core.routes })

  const router = renderApp('/stock')
  await findQuantity('Product 01')
  await type('Product 01', '40')
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await findQuantity('Product 25')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Stock saved.')).toBeInTheDocument()

  core.hold()
  await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
  await waitFor(() => expect(router.state.location.search).toEqual({}))
  expect(screen.queryByRole('textbox', { name: 'Quantity of Product 01' })).not.toBeInTheDocument()
  core.release()
  expect(await findQuantity('Product 01')).toHaveValue('40')
})

test('an edit typed back to the saved quantity is no change, and nothing is sent', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, [milk])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/stock')
  await findQuantity('Sunny Fields Toned Milk')
  const save = screen.getByRole('button', { name: 'Save changes' })
  expect(save).toHaveAttribute('aria-disabled', 'true')
  await type('Sunny Fields Toned Milk', '18')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  expect(save).toHaveAttribute('aria-disabled', 'false')
  await type('Sunny Fields Toned Milk', '17')

  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  expect(screen.queryByText('Unsaved')).not.toBeInTheDocument()
  await userEvent.click(save)
  expect(save).not.toBeDisabled()
  expect(core.puts).toEqual([])
})

test('discard puts every quantity back to what core holds', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, [banana, milk])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await type('Sunny Fields Toned Milk', '')
  expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))

  expect(quantity('Banana Robusta')).toHaveValue('0')
  expect(quantity('Sunny Fields Toned Milk')).toHaveValue('17')
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Discard changes' })).toHaveFocus()
  expect(core.puts).toEqual([])
})

test('a quantity the page cannot send is marked, named on save and not sent', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, [banana, milk])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/stock')
  await findQuantity('Sunny Fields Toned Milk')
  await type('Sunny Fields Toned Milk', '12.5')
  await type('Banana Robusta', '9')
  expect(quantity('Sunny Fields Toned Milk')).toHaveAttribute('aria-invalid', 'true')
  expect(quantity('Banana Robusta')).not.toHaveAttribute('aria-invalid')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number from 0 to 100000 for: Sunny Fields Toned Milk.')
  expect(core.puts).toEqual([])

  await type('Sunny Fields Toned Milk', '100001')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(quantity('Sunny Fields Toned Milk')).toHaveAttribute('aria-invalid', 'true')
  await type('Sunny Fields Toned Milk', '12')
  expect(quantity('Sunny Fields Toned Milk')).not.toHaveAttribute('aria-invalid')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Stock saved.')).toBeInTheDocument()
  expect(core.puts).toEqual([{ rows: [{ productId: milk.productId, quantity: 12 }, { productId: banana.productId, quantity: 9 }] }])
})

test('an edit typed while a save is in flight stays unsaved, and the save still finishes once and is confirmed', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, [banana, milk])
  const put = `PUT /admin/stores/${indiranagar.id}/stock`
  let answer = () => {}
  fakeCore({
    ...asAdmin,
    ...core.routes,
    [put]: async (request) => {
      const response = await core.routes[put](request)
      await new Promise<void>((resolve) => (answer = resolve))
      return response
    },
  })

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  const save = screen.getByRole('button', { name: 'Save changes' })
  await userEvent.click(save)
  await waitFor(() => expect(core.puts).toHaveLength(1))
  await type('Sunny Fields Toned Milk', '20')

  expect(save).toHaveTextContent('Saving…')
  expect(save).toHaveAttribute('aria-disabled', 'true')
  await userEvent.click(save)
  answer()

  expect(await screen.findByText('Stock saved.')).toBeInTheDocument()
  expect(core.puts).toEqual([{ rows: [{ productId: banana.productId, quantity: 30 }] }])
  expect(save).toHaveTextContent('Save changes')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  expect(quantity('Banana Robusta')).toHaveValue('30')
  expect(quantity('Sunny Fields Toned Milk')).toHaveValue('20')
  expect(within(quantity('Sunny Fields Toned Milk').closest('tr')!).getByText('Unsaved')).toBeInTheDocument()
})

test('unsaved edits never follow a store changed in the URL', async () => {
  setToken('tok')
  const other = stockCore(koramangala.id, [banana])
  fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [banana]).routes, ...other.routes })

  const router = renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await router.navigate({ to: '/stock', search: { store: koramangala.id } })

  await waitFor(() => expect(screen.getByLabelText('Store')).toHaveValue(koramangala.id))
  expect(await findQuantity('Banana Robusta')).toHaveValue('0')
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(other.puts).toEqual([])
})

test('while the next page loads, the rows on screen are marked busy, keep their own page number and cannot be edited', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, thirty)
  fakeCore({ ...asAdmin, ...core.routes })
  const busy = () => screen.getByRole('table', { name: 'Stock' }).closest('[aria-busy="true"]')

  renderApp('/stock')
  await findQuantity('Product 01')
  expect(busy()).toBeNull()
  expect(quantity('Product 01')).not.toHaveAttribute('readonly')
  core.hold()
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))

  await waitFor(() => expect(busy()).not.toBeNull())
  expect(busy()).toHaveClass('opacity-50')
  expect(screen.getByText('Page 1 of 2, 30 products')).toBeInTheDocument()
  expect(quantity('Product 01')).toHaveAttribute('readonly')
  expect(quantity('Product 01')).not.toBeDisabled()
  quantity('Product 01').focus()
  await userEvent.keyboard('9')
  expect(quantity('Product 01')).toHaveValue('0')
  expect(quantity('Product 01')).toHaveFocus()
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()

  core.release()
  expect(await screen.findByText('Page 2 of 2, 30 products')).toBeInTheDocument()
  expect(busy()).toBeNull()
  expect(quantity('Product 25')).not.toHaveAttribute('readonly')
})

test('Back and Forward move the search field and the list with the URL, and unsaved edits stay', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [...thirty, milk]).routes })

  const router = renderApp('/stock')
  await findQuantity('Product 01')
  await type('Product 01', '40')
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), ' milk ')
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(await findQuantity('Sunny Fields Toned Milk')).toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('milk')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()

  router.history.back()
  expect(await screen.findByText('Page 1 of 2, 31 products')).toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('')
  expect(router.state.location.search).toEqual({})
  expect(quantity('Product 01')).toHaveValue('40')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()

  router.history.forward()
  expect(await findQuantity('Sunny Fields Toned Milk')).toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('milk')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
})

test('Save changes keeps keyboard focus through a save and is never disabled', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, [banana])
  const put = `PUT /admin/stores/${indiranagar.id}/stock`
  let answer = () => {}
  fakeCore({
    ...asAdmin,
    ...core.routes,
    [put]: async (request) => {
      const response = await core.routes[put](request)
      await new Promise<void>((resolve) => (answer = resolve))
      return response
    },
  })

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  const save = screen.getByRole('button', { name: 'Save changes' })
  await userEvent.click(save)

  await waitFor(() => expect(save).toHaveTextContent('Saving…'))
  expect(save).toHaveAttribute('aria-disabled', 'true')
  expect(save).not.toBeDisabled()
  expect(save).toHaveFocus()
  answer()
  expect(await screen.findByText('Stock saved.')).toBeInTheDocument()
  expect(save).toHaveTextContent('Save changes')
  expect(save).not.toBeDisabled()
  expect(save).toHaveFocus()
})

test('a value that reads as the stored quantity is no edit, and Discard with nothing unsaved changes nothing', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, [banana, milk])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/stock')
  await findQuantity('Sunny Fields Toned Milk')
  expect(screen.getByText('No unsaved changes')).toHaveAttribute('role', 'status')
  await type('Sunny Fields Toned Milk', '017')
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  expect(quantity('Sunny Fields Toned Milk')).toHaveValue('17')
  expect(screen.queryByText('Unsaved')).not.toBeInTheDocument()

  await type('Banana Robusta', '30')
  expect(screen.getByText('1 unsaved change')).toHaveAttribute('role', 'status')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Stock saved.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
  expect(screen.getByText('Stock saved.')).toBeInTheDocument()
  expect(core.puts).toHaveLength(1)
})

test('a store changed through the URL drops the edits for good: they are not back on return', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [banana]).routes, ...stockCore(koramangala.id, [milk]).routes })

  const router = renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await router.navigate({ to: '/stock', search: { store: koramangala.id } })
  await findQuantity('Sunny Fields Toned Milk')
  router.history.back()

  expect(await findQuantity('Banana Robusta')).toHaveValue('0')
  expect(screen.getByLabelText('Store')).toHaveValue(indiranagar.id)
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
})

test('a save that answers after the store changed leaves the other store\'s edits alone', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, [banana])
  const put = `PUT /admin/stores/${indiranagar.id}/stock`
  let answer = () => {}
  fakeCore({
    ...asAdmin,
    ...core.routes,
    ...stockCore(koramangala.id, [banana]).routes,
    [put]: async (request) => {
      const response = await core.routes[put](request)
      await new Promise<void>((resolve) => (answer = resolve))
      return response
    },
  })

  const router = renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(core.puts).toHaveLength(1))
  await router.navigate({ to: '/stock', search: { store: koramangala.id } })
  await waitFor(() => expect(screen.getByLabelText('Store')).toHaveValue(koramangala.id))
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  answer()

  await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAttribute('aria-disabled', 'false'))
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  expect(quantity('Banana Robusta')).toHaveValue('30')
  expect(screen.queryByText('Stock saved.')).not.toBeInTheDocument()
})

test('switching store with unsaved edits asks first', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [banana]).routes, ...stockCore(koramangala.id, [milk]).routes })
  const toKoramangala = () => calls.filter((call) => call.url.includes(koramangala.id))

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await userEvent.selectOptions(screen.getByLabelText('Store'), koramangala.id)

  const dialog = screen.getByRole('dialog', { name: 'Discard unsaved changes?' })
  expect(dialog).toHaveTextContent("Switching store discards the unsaved change to this store's stock.")
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Discard and switch'])
  expect(screen.getByLabelText('Store')).toHaveValue(indiranagar.id)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(quantity('Banana Robusta')).toHaveValue('30')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  expect(toKoramangala()).toEqual([])

  await userEvent.selectOptions(screen.getByLabelText('Store'), koramangala.id)
  await userEvent.click(screen.getByRole('button', { name: 'Discard and switch' }))
  expect(await findQuantity('Sunny Fields Toned Milk')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(koramangala.id)
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()

  await userEvent.selectOptions(screen.getByLabelText('Store'), indiranagar.id)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(await findQuantity('Banana Robusta')).toHaveValue('0')
})

test('a save refused for a deleted product says so and keeps the edits', async () => {
  setToken('tok')
  fakeCore({
    ...asAdmin,
    ...stockCore(indiranagar.id, [banana, milk]).routes,
    [`PUT /admin/stores/${indiranagar.id}/stock`]: () => apiError(400, 'validation', 'unknown product', 'rows'),
  })

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('These changes were refused: a changed product may have been deleted. Discard the changes and try again.')
  expect(quantity('Banana Robusta')).toHaveValue('30')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  expect(screen.queryByText('Stock saved.')).not.toBeInTheDocument()

  await type('Sunny Fields Toned Milk', '20')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('any other save failure shows a banner, keeps the edits and can be retried', async () => {
  setToken('tok')
  let fail = true
  const core = stockCore(indiranagar.id, [banana])
  const put = `PUT /admin/stores/${indiranagar.id}/stock`
  fakeCore({ ...asAdmin, ...core.routes, [put]: (request) => (fail ? apiError(500, 'internal') : core.routes[put](request)) })

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the stock. Try again.')
  expect(quantity('Banana Robusta')).toHaveValue('30')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()

  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Stock saved.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(core.puts).toEqual([{ rows: [{ productId: banana.productId, quantity: 30 }] }])
})

test('a page in the URL beyond what core accepts is cut to one it does, then to the last page', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, thirty)
  const get = `GET /admin/stores/${indiranagar.id}/stock`
  // Core answers 400 to a page whose offset passes its integer range: at 24 a page, any page above 89478486.
  const calls = fakeCore({
    ...asAdmin,
    ...core.routes,
    [get]: (request) =>
      Number(new URL(request.url).searchParams.get('page')) > 89478486 ? apiError(400, 'validation', 'too large', 'page') : core.routes[get](request),
  })

  renderApp('/stock?page=2147483648')

  expect(await screen.findByText('Page 2 of 2, 30 products')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(calls.map((call) => new URL(call.url).searchParams.get('page')).filter(Boolean)).toEqual(['100000', '2'])
})

test('a search in the URL loses NUL bytes and is cut to the 100 characters core takes', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [milk]).routes })
  const cut = 'm'.repeat(60) + 'k'.repeat(40)

  renderApp(`/stock?q=${'m'.repeat(60)}%00${'k'.repeat(60)}`)

  expect(await screen.findByRole('heading', { level: 2, name: 'No products found' })).toBeInTheDocument()
  expect(lastListQuery(calls).q).toBe(cut)
  const field = within(screen.getByRole('search', { name: 'Search stock' })).getByRole('searchbox', { name: 'Search' })
  expect(field).toHaveValue(cut)
  expect(field).toHaveAttribute('maxlength', '100')
})

test.each(['page=banana', 'page=1.5', 'lowStock=banana'])('?%s in the URL is read as page 1 with the filter off', async (search) => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, thirty).routes })

  renderApp(`/stock?${search}`)

  expect(await screen.findByText('Page 1 of 2, 30 products')).toBeInTheDocument()
  expect(lastListQuery(calls)).toEqual({ page: '1', pageSize: '24' })
  expect(screen.getByRole('button', { name: 'Low stock only' })).toHaveAttribute('aria-pressed', 'false')
})

test('store staff get the stock without a store name when the name cannot be read', async () => {
  setToken('tok')
  const calls = fakeCore({
    'GET /admin/me': () => json(200, storeStaff),
    [`GET /stores/${storeStaff.storeId}`]: () => apiError(500, 'internal'),
    ...stockCore(storeStaff.storeId!, [milk]).routes,
  })

  renderApp('/stock')

  expect(await findQuantity('Sunny Fields Toned Milk')).toHaveValue('17')
  await waitFor(() => expect(calls.some((call) => new URL(call.url).pathname.endsWith(`/stores/${storeStaff.storeId}`))).toBe(true))
  expect(screen.queryByText('Store:')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
})

test('an admin is not asked for a store name: the selector names the store', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [milk]).routes })

  renderApp('/stock')

  await findQuantity('Sunny Fields Toned Milk')
  expect(calls.map((call) => new URL(call.url).pathname.replace('/api/core/v1', ''))).toEqual(['/admin/me', '/admin/stores', `/admin/stores/${indiranagar.id}/stock`])
})

test('a save answered without core\'s error body is a failed save: alert, edits kept, never "Stock saved."', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, [banana])
  fakeCore({ ...asAdmin, ...core.routes, [`PUT /admin/stores/${indiranagar.id}/stock`]: () => new Response(null, { status: 502 }) })

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the stock. Try again.')
  expect(quantity('Banana Robusta')).toHaveValue('30')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  expect(screen.queryByText('Stock saved.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAttribute('aria-disabled', 'false')
})

test('a search in the URL whose 100th character is an emoji is cut after it, never through it', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [milk]).routes })
  const cut = `${'a'.repeat(99)}😀`

  renderApp(`/stock?q=${encodeURIComponent(`${cut}b`)}`)

  expect(await screen.findByRole('heading', { level: 2, name: 'No products found' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(lastListQuery(calls).q).toBe(cut)
  expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue(cut)
})

test('after a failed save and "Discard and switch", returning to the store shows no alert', async () => {
  setToken('tok')
  fakeCore({
    ...asAdmin,
    ...stockCore(indiranagar.id, [banana]).routes,
    ...stockCore(koramangala.id, [milk]).routes,
    [`PUT /admin/stores/${indiranagar.id}/stock`]: () => apiError(400, 'validation', 'unknown product', 'rows'),
  })

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('These changes were refused')
  await userEvent.selectOptions(screen.getByLabelText('Store'), koramangala.id)
  await userEvent.click(screen.getByRole('button', { name: 'Discard and switch' }))
  await findQuantity('Sunny Fields Toned Milk')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Store'), indiranagar.id)

  expect(await findQuantity('Banana Robusta')).toHaveValue('0')
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('"Stock saved." is not shown again after leaving the store and returning', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [banana]).routes, ...stockCore(koramangala.id, [milk]).routes })

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Stock saved.')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Store'), koramangala.id)
  await findQuantity('Sunny Fields Toned Milk')
  expect(screen.queryByText('Stock saved.')).not.toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Store'), indiranagar.id)

  expect(await findQuantity('Banana Robusta')).toHaveValue('30')
  expect(screen.queryByText('Stock saved.')).not.toBeInTheDocument()
})

test('a save that fails after its edits were discarded shows no alert asking to try again', async () => {
  setToken('tok')
  const put = `PUT /admin/stores/${indiranagar.id}/stock`
  let answer = () => {}
  fakeCore({
    ...asAdmin,
    ...stockCore(indiranagar.id, [banana]).routes,
    [put]: async () => {
      await new Promise<void>((resolve) => (answer = resolve))
      return apiError(500, 'internal')
    },
  })

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  const save = screen.getByRole('button', { name: 'Save changes' })
  await userEvent.click(save)
  await waitFor(() => expect(save).toHaveTextContent('Saving…'))
  await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
  answer()

  await waitFor(() => expect(save).toHaveTextContent('Save changes'))
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('Escape closes the switch dialog and keeps the store and the edits', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [banana]).routes, ...stockCore(koramangala.id, [milk]).routes })

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await userEvent.selectOptions(screen.getByLabelText('Store'), koramangala.id)
  expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(indiranagar.id)
  expect(quantity('Banana Robusta')).toHaveValue('30')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
})
