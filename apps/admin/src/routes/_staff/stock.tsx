import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { Badge, Button, Card, Chip, Dialog, DialogFooter, EmptyState, ErrorBanner, FormField, ImageTile, Input, PageHeader, Price, Select, Skeleton, StatusMessage, Table, cn, type Column } from '@shopperstop/ui'
import { api, type ApiError } from '../../api'
import { cleanSearch, lowStockBelow, maxPage, maxQuantity, maxSearch, pageSize, parseQuantity, stockQuery, storeNameQuery, toRows, type Edits, type StockRow, type StockSearch } from '../../stock'
import { storesQuery, type AdminStore } from '../../stores'

function StoreStock({ storeId, stores }: { storeId: string; stores?: AdminStore[] }) {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const page = search.page ?? 1
  const stock = useQuery(stockQuery(storeId, { q: search.q, lowStock: search.lowStock, page }))
  // Store staff get no selector; their store's name is shown when it can be read, and left out when it cannot.
  const ownStore = useQuery({ ...storeNameQuery(storeId), enabled: !stores })
  const [text, setText] = useState(search.q ?? '')
  // The field follows the URL: Back and Forward change `q` without a submit.
  const [shownQ, setShownQ] = useState(search.q)
  if (shownQ !== search.q) {
    setShownQ(search.q)
    setText(search.q ?? '')
  }
  // Rows kept from the page or filter before, while the one asked for loads: shown dimmed, not editable.
  const stale = stock.isPlaceholderData
  // Unsaved edits belong to one store, so they can never be shown for, or saved to, another.
  // `visit` counts the store changes: the result of a save is shown only during the visit it was made in.
  const [draft, setDraft] = useState<{ store: string; visit: number; edits: Edits }>({ store: storeId, visit: 0, edits: {} })
  const [refused, setRefused] = useState(false)
  const [switchTo, setSwitchTo] = useState<string>()
  // A store change, however it happens (selector, link, Back), drops them for good: React renders again at once with the empty draft.
  if (draft.store !== storeId) setDraft({ store: storeId, visit: draft.visit + 1, edits: {} })
  const edits = draft.edits
  const count = Object.keys(edits).length
  const invalid = Object.values(edits).filter((edit) => parseQuantity(edit.value) === undefined)

  const save = useMutation({
    mutationFn: async (sent: { store: string; visit: number; edits: Edits }) => {
      const rows = toRows(sent.edits)
      const { error } = await api.PUT('/admin/stores/{id}/stock', { params: { path: { id: sent.store } }, body: { rows } })
      if (error) throw error.error
      return rows
    },
    onSuccess: async (rows, sent) => {
      const done = new Map(rows.map((row) => [row.productId, row.quantity]))
      // Kept pages hold the old quantities: drop the ones not on screen and read this one again before the edits go.
      // The page on screen gets what was saved first: if that read fails its rows stay, and must not show the old quantities.
      queryClient.removeQueries({ queryKey: ['admin', 'stock', sent.store], type: 'inactive' })
      queryClient.setQueriesData<{ items: StockRow[] }>(
        { queryKey: ['admin', 'stock', sent.store] },
        (shown) => shown && { ...shown, items: shown.items.map((row) => ({ ...row, quantity: done.get(row.productId) ?? row.quantity })) },
      )
      await queryClient.invalidateQueries({ queryKey: ['admin', 'stock', sent.store] })
      // Only what was sent is saved: an edit typed since, or beyond the 500 rows of one PUT, stays unsaved.
      setDraft((current) =>
        current.store === sent.store
          ? { ...current, edits: Object.fromEntries(Object.entries(current.edits).filter(([id, edit]) => !done.has(id) || done.get(id) !== parseQuantity(edit.value))) }
          : current,
      )
    },
  })
  // Not after the store changed and the admin came back, and no "try again" when nothing is left to save.
  const saved = save.variables?.visit === draft.visit
  const saveError = saved && save.error && count > 0 ? (save.error as Partial<ApiError>) : undefined

  // Filters and the store live in the URL; any change of them starts again at page 1.
  const go = (change: StockSearch) => void navigate({ search: (current) => ({ ...current, page: undefined, ...change }) })

  // A page past the end (a save emptied it, or a typed URL) moves to the last page that has rows.
  const total = stock.data?.total ?? 0
  const pastEnd = page > 1 && !stale && stock.data?.items.length === 0
  useEffect(() => {
    const last = Math.ceil(total / pageSize)
    if (pastEnd) void navigate({ search: (current) => ({ ...current, page: last > 1 ? last : undefined }), replace: true })
  }, [pastEnd, total, navigate])

  // The result of the last save is cleared by the next edit, but never while a save runs: reset() would detach it.
  function forget() {
    if (!save.isPending) save.reset()
    setRefused(false)
  }

  function edit(row: StockRow, value: string) {
    forget()
    const next = { ...edits, [row.productId]: { name: row.name, value } }
    // A value that reads as what core holds (17, 017, " 17 ") is no edit.
    if (parseQuantity(value) === row.quantity) delete next[row.productId]
    setDraft({ ...draft, edits: next })
  }

  function discard() {
    if (count === 0) return
    forget()
    setDraft({ ...draft, edits: {} })
  }

  function submitSave() {
    if (count === 0 || save.isPending) return
    if (invalid.length > 0) return setRefused(true)
    save.mutate({ store: storeId, visit: draft.visit, edits })
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    go({ q: text.trim() || undefined })
  }

  const columns: Column<StockRow>[] = [
    { key: 'image', header: 'Image', cell: (row) => <ImageTile src={row.imageUrl} alt="" className="w-10 border border-line" /> },
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
        {ownStore.data && (
          <p className="flex h-11 items-center gap-1 text-body text-ink sm:h-10">
            Store: <span className="font-semibold">{ownStore.data}</span>
          </p>
        )}
        {stores && (
          <FormField label="Store">
            <Select value={storeId} onChange={(event) => (count > 0 ? setSwitchTo(event.target.value) : go({ store: event.target.value }))}>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </Select>
          </FormField>
        )}
        <form role="search" aria-label="Search stock" noValidate onSubmit={submitSearch} className="flex items-end gap-2">
          <FormField label="Search">
            <Input type="search" maxLength={maxSearch} value={text} onChange={(event) => setText(event.target.value)} />
          </FormField>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <Chip selected={search.lowStock === true} onClick={() => go({ lowStock: search.lowStock ? undefined : true })}>
          Low stock only
        </Chip>
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <p role="status" className="text-body text-ink tabular-nums">
          {count === 0 ? 'No unsaved changes' : count === 1 ? '1 unsaved change' : `${count} unsaved changes`}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" aria-disabled={count === 0} onClick={discard}>Discard changes</Button>
          <Button aria-disabled={count === 0 || save.isPending} onClick={submitSave}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </Card>
      {refused && invalid.length > 0 && (
        <ErrorBanner message={`Enter a whole number from 0 to ${maxQuantity} for: ${invalid.map((edit) => edit.name).join(', ')}.`} />
      )}
      {saveError && (
        <ErrorBanner
          message={
            saveError.code === 'validation'
              ? 'These changes were refused: a changed product may have been deleted. Discard the changes and try again.'
              : 'Could not save the stock. Try again.'
          }
        />
      )}
      {saved && save.isSuccess && <StatusMessage tone="success">Stock saved.</StatusMessage>}
      {stock.data === undefined ? (
        stock.isError ? (
          <ErrorBanner message="Could not load the stock." onRetry={() => void stock.refetch()} />
        ) : (
          <Skeleton variant="table" count={6} />
        )
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
            <Button variant="secondary" aria-disabled={page <= 1} onClick={() => page > 1 && go({ page: page - 1 })}>
              Previous
            </Button>
            <p className="text-body text-ink tabular-nums">
              Page {stock.data.page} of {pages}, {total} products
            </p>
            <Button variant="secondary" aria-disabled={page >= pages} onClick={() => page < pages && go({ page: page + 1 })}>
              Next
            </Button>
          </nav>
        </>
      )}
      <Dialog open={switchTo !== undefined} onClose={() => setSwitchTo(undefined)} title="Discard unsaved changes?">
        <p className="mt-2 text-body text-ink">
          Switching store discards {count === 1 ? 'the unsaved change' : `the ${count} unsaved changes`} to this store's stock.
        </p>
        <DialogFooter onCancel={() => setSwitchTo(undefined)}>
          <Button
            onClick={() => {
              setSwitchTo(undefined)
              go({ store: switchTo })
            }}
          >
            Discard and switch
          </Button>
        </DialogFooter>
      </Dialog>
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
      ) : stores.data === undefined ? (
        stores.isError ? (
          <ErrorBanner message="Could not load the stores." onRetry={() => void stores.refetch()} />
        ) : (
          <Skeleton variant="table" count={6} />
        )
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
  // Core answers 400 to a NUL byte or more than 100 characters in q, and to a page far beyond any list: neither is sent.
  // The field's maxLength counts UTF-16 units, so it lets through at most 100 characters; cleanSearch has the last word.
  validateSearch: (search: Record<string, unknown>): StockSearch => ({
    store: typeof search.store === 'string' ? search.store : undefined,
    q: search.q === undefined ? undefined : cleanSearch(String(search.q)) || undefined,
    lowStock: search.lowStock === true ? true : undefined,
    page: typeof search.page === 'number' && Number.isInteger(search.page) && search.page > 1 ? Math.min(search.page, maxPage) : undefined,
  }),
  component: Stock,
})
