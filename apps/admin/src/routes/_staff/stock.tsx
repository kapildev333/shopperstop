import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { Badge, Button, Card, Chip, EmptyState, ErrorBanner, FormField, Input, PageHeader, Price, Select, Skeleton, StatusMessage, Table, cn, type Column } from '@shopperstop/ui'
import { api } from '../../api'
import { lowStockBelow, maxQuantity, pageSize, parseQuantity, stockQuery, toRows, type Edits, type StockRow, type StockSearch } from '../../stock'
import { storesQuery, type AdminStore } from '../../stores'

// A button that cannot act now stays focusable: `disabled` would drop keyboard focus from the button just pressed.
const idle = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

function StoreStock({ storeId, stores }: { storeId: string; stores?: AdminStore[] }) {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const page = search.page ?? 1
  const stock = useQuery(stockQuery(storeId, { q: search.q, lowStock: search.lowStock, page }))
  const [text, setText] = useState(search.q ?? '')
  // The field follows the URL: Back and Forward change `q` without a submit.
  const [shownQ, setShownQ] = useState(search.q)
  if (shownQ !== search.q) {
    setShownQ(search.q)
    setText(search.q ?? '')
  }
  // Rows kept from the page or filter before, while the one asked for loads: shown dimmed, not editable.
  const stale = stock.isPlaceholderData
  // Unsaved edits belong to one store: read for any other store they are empty, so they can never be saved to it.
  const [draft, setDraft] = useState<{ store: string; edits: Edits }>({ store: storeId, edits: {} })
  const [refused, setRefused] = useState(false)
  const edits = draft.store === storeId ? draft.edits : {}
  const count = Object.keys(edits).length
  const invalid = Object.values(edits).filter((edit) => parseQuantity(edit.value) === undefined)

  const save = useMutation({
    mutationFn: async (sent: { store: string; edits: Edits }) => {
      const rows = toRows(sent.edits)
      const { error } = await api.PUT('/admin/stores/{id}/stock', { params: { path: { id: sent.store } }, body: { rows } })
      if (error) throw error.error
      return rows
    },
    onSuccess: async (rows, sent) => {
      // Kept pages hold the old quantities: drop the ones not on screen and read this one again before the edits go.
      queryClient.removeQueries({ queryKey: ['admin', 'stock', sent.store], type: 'inactive' })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'stock', sent.store] })
      // Only what was sent is saved: an edit typed since stays unsaved.
      const done = new Map(rows.map((row) => [row.productId, row.quantity]))
      setDraft((current) =>
        current.store === sent.store
          ? { store: current.store, edits: Object.fromEntries(Object.entries(current.edits).filter(([id, edit]) => !done.has(id) || done.get(id) !== parseQuantity(edit.value))) }
          : current,
      )
    },
  })
  const saved = save.variables?.store === storeId

  // Filters and the store live in the URL; any change of them starts again at page 1.
  const go = (change: StockSearch) => void navigate({ search: (current) => ({ ...current, page: undefined, ...change }) })

  // A page past the end (a save emptied it, or a typed URL) moves to the last page that has rows.
  const total = stock.data?.total ?? 0
  const pastEnd = page > 1 && !stale && stock.data?.items.length === 0
  useEffect(() => {
    const last = Math.ceil(total / pageSize)
    if (pastEnd) void navigate({ search: (current) => ({ ...current, page: last > 1 ? last : undefined }), replace: true })
  }, [pastEnd, total, navigate])

  function edit(row: StockRow, value: string) {
    save.reset()
    setRefused(false)
    const next = { ...edits, [row.productId]: { name: row.name, value } }
    // Typed back to what core holds is no edit.
    if (value.trim() === String(row.quantity)) delete next[row.productId]
    setDraft({ store: storeId, edits: next })
  }

  function discard() {
    save.reset()
    setRefused(false)
    setDraft({ store: storeId, edits: {} })
  }

  function submitSave() {
    if (count === 0 || save.isPending) return
    if (invalid.length > 0) return setRefused(true)
    save.mutate({ store: storeId, edits })
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    go({ q: text.trim() || undefined })
  }

  const columns: Column<StockRow>[] = [
    {
      key: 'product',
      header: 'Product',
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{row.name}</span>
          {row.brand && <span className="text-small text-ink-muted">{row.brand}</span>}
        </span>
      ),
    },
    { key: 'unit', header: 'Unit', cell: (row) => row.unitLabel },
    { key: 'price', header: 'Price', cell: (row) => <Price cents={row.priceCents} /> },
    {
      key: 'quantity',
      header: 'Quantity',
      cell: (row) => {
        const value = edits[row.productId]?.value
        return (
          <span className="block w-28">
            <Input
              aria-label={`Quantity of ${row.name}`}
              aria-invalid={value !== undefined && parseQuantity(value) === undefined ? true : undefined}
              inputMode="numeric"
              className="tabular-nums"
              readOnly={stale}
              value={value ?? String(row.quantity)}
              onChange={(event) => edit(row, event.target.value)}
            />
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <span className="flex flex-wrap gap-2">
          {row.quantity < lowStockBelow && <Badge variant="warning">Low stock</Badge>}
          {edits[row.productId] && <Badge variant="accent">Unsaved</Badge>}
        </span>
      ),
    },
  ]

  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <>
      <Card className="flex flex-wrap items-end gap-4 p-4">
        {stores && (
          <FormField label="Store">
            <Select value={storeId} onChange={(event) => go({ store: event.target.value })}>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </Select>
          </FormField>
        )}
        <form role="search" aria-label="Stock" noValidate onSubmit={submitSearch} className="flex items-end gap-2">
          <FormField label="Search">
            <Input type="search" value={text} onChange={(event) => setText(event.target.value)} />
          </FormField>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <Chip selected={search.lowStock === true} onClick={() => go({ lowStock: search.lowStock ? undefined : true })}>
          Low stock only
        </Chip>
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <p className="text-body text-ink tabular-nums">
          {count === 0 ? 'No unsaved changes' : count === 1 ? '1 unsaved change' : `${count} unsaved changes`}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" aria-disabled={count === 0} className={idle} onClick={discard}>Discard changes</Button>
          <Button aria-disabled={count === 0} className={idle} loading={save.isPending} onClick={submitSave}>Save changes</Button>
        </div>
      </Card>
      {refused && invalid.length > 0 && (
        <ErrorBanner message={`Enter a whole number from 0 to ${maxQuantity} for: ${invalid.map((edit) => edit.name).join(', ')}.`} />
      )}
      {saved && save.isSuccess && <StatusMessage tone="success">Stock saved.</StatusMessage>}
      {stock.isPending ? (
        <Skeleton variant="table" count={6} />
      ) : stock.isError ? (
        <ErrorBanner message="Could not load the stock." onRetry={() => void stock.refetch()} />
      ) : stock.data.items.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No products found" description="Change the search or the filter. Only active products are listed." />
        </Card>
      ) : (
        <>
          <Card aria-busy={stale} className={cn('overflow-hidden', stale && 'opacity-50')}>
            <Table stack caption="Stock" columns={columns} rows={stock.data.items} rowKey={(row) => row.productId} />
          </Card>
          <nav aria-label="Pages" className="flex items-center justify-between gap-4">
            <Button variant="secondary" aria-disabled={page <= 1} className={idle} onClick={() => page > 1 && go({ page: page - 1 })}>
              Previous
            </Button>
            <p className="text-body text-ink tabular-nums">
              Page {stock.data.page} of {pages}, {total} products
            </p>
            <Button variant="secondary" aria-disabled={page >= pages} className={idle} onClick={() => page < pages && go({ page: page + 1 })}>
              Next
            </Button>
          </nav>
        </>
      )}
    </>
  )
}

function Stock() {
  const { staff } = Route.useRouteContext()
  const search = Route.useSearch()
  // Store staff carry their store and may not list stores (403); an admin has none and picks one.
  const stores = useQuery({ ...storesQuery, enabled: !staff.storeId })
  const items = stores.data?.items ?? []
  // ponytail: a `store` in the URL that is not in the list falls back to the first store, without a message.
  const storeId = items.find((store) => store.id === search.store)?.id ?? items[0]?.id

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Stock" />
      {staff.storeId ? (
        <StoreStock storeId={staff.storeId} />
      ) : stores.isPending ? (
        <Skeleton variant="table" count={6} />
      ) : stores.isError ? (
        <ErrorBanner message="Could not load the stores." onRetry={() => void stores.refetch()} />
      ) : storeId ? (
        <StoreStock storeId={storeId} stores={items} />
      ) : (
        <Card className="p-6">
          <EmptyState title="No stores yet" description="Create a store, then set its stock here." />
        </Card>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/stock')({
  // The router reads search values as JSON: `page=2` is a number, `lowStock=true` a boolean, a search of digits a number.
  validateSearch: (search: Record<string, unknown>): StockSearch => ({
    store: typeof search.store === 'string' ? search.store : undefined,
    q: search.q === undefined || search.q === '' ? undefined : String(search.q),
    lowStock: search.lowStock === true ? true : undefined,
    page: typeof search.page === 'number' && Number.isInteger(search.page) && search.page > 1 ? search.page : undefined,
  }),
  component: Stock,
})
