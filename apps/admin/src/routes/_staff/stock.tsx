import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { Badge, Button, Card, Chip, EmptyState, ErrorBanner, FormField, Input, PageHeader, Price, Select, Skeleton, Table, type Column } from '@shopperstop/ui'
import { lowStockBelow, pageSize, stockQuery, type StockRow, type StockSearch } from '../../stock'
import { storesQuery, type AdminStore } from '../../stores'

// A button that cannot act now stays focusable: `disabled` would drop keyboard focus from the button just pressed.
const idle = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

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
    // Read-only until the next task makes it editable.
    cell: (row) => (
      <span className="block w-28">
        <Input aria-label={`Quantity of ${row.name}`} inputMode="numeric" className="tabular-nums" readOnly value={String(row.quantity)} />
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => <span className="flex flex-wrap gap-2">{row.quantity < lowStockBelow && <Badge variant="warning">Low stock</Badge>}</span>,
  },
]

function StoreStock({ storeId, stores }: { storeId: string; stores?: AdminStore[] }) {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const page = search.page ?? 1
  const stock = useQuery(stockQuery(storeId, { q: search.q, lowStock: search.lowStock, page }))
  const [text, setText] = useState(search.q ?? '')

  // Filters and the store live in the URL; any change of them starts again at page 1.
  const go = (change: StockSearch) => void navigate({ search: (current) => ({ ...current, page: undefined, ...change }) })

  // A page past the end (a save emptied it, or a typed URL) moves to the last page that has rows.
  const total = stock.data?.total ?? 0
  const pastEnd = page > 1 && !stock.isPlaceholderData && stock.data?.items.length === 0
  useEffect(() => {
    const last = Math.ceil(total / pageSize)
    if (pastEnd) void navigate({ search: (current) => ({ ...current, page: last > 1 ? last : undefined }), replace: true })
  }, [pastEnd, total, navigate])

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    go({ q: text.trim() || undefined })
  }

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
          <Card className="overflow-hidden">
            <Table stack caption="Stock" columns={columns} rows={stock.data.items} rowKey={(row) => row.productId} />
          </Card>
          <nav aria-label="Pages" className="flex items-center justify-between gap-4">
            <Button variant="secondary" aria-disabled={page <= 1} className={idle} onClick={() => page > 1 && go({ page: page - 1 })}>
              Previous
            </Button>
            <p className="text-body text-ink tabular-nums">
              Page {page} of {pages}, {total} products
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
