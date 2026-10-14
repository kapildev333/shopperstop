import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Badge, Button, Card, EmptyState, ErrorBanner, FormField, Input, PageHeader, Price, Select, Skeleton, Table, buttonClass, type Column } from '@shopperstop/ui'
import { categoriesQuery, categoryOptions, pageSize, productsQuery, type Product, type ProductFilters } from '../../../../catalog'
import { ImageTile } from '../../../../image'

const first: ProductFilters = { q: '', categoryId: '', isActive: '', page: 1 }

function Products() {
  // ponytail: filters live in the page, so they reset when the admin leaves it; move them to the URL search if asked.
  const [filters, setFilters] = useState(first)
  const [search, setSearch] = useState('')
  const products = useQuery(productsQuery(filters))
  const categories = useQuery(categoriesQuery)
  const options = categoryOptions(categories.data?.items ?? [])
  const categoryName = new Map(options.map((option) => [option.id, option.label]))

  const filter = (change: Partial<ProductFilters>) => setFilters((current) => ({ ...current, page: 1, ...change }))
  function submit(event: FormEvent) {
    event.preventDefault()
    filter({ q: search.trim() })
  }

  const columns: Column<Product>[] = [
    { key: 'image', header: 'Image', cell: (product) => <ImageTile src={product.imageUrl} className="w-10" /> },
    {
      key: 'name',
      header: 'Name',
      cell: (product) => (
        <span className="flex flex-col">
          <Link to="/products/$productId" params={{ productId: product.id }} className="font-semibold text-accent hover:underline">
            {product.name}
          </Link>
          {product.brand && <span className="text-small text-ink-muted">{product.brand}</span>}
        </span>
      ),
    },
    { key: 'category', header: 'Category', cell: (product) => categoryName.get(product.categoryId) ?? '' },
    { key: 'unit', header: 'Unit', cell: (product) => product.unitLabel },
    { key: 'price', header: 'Price', cell: (product) => <Price cents={product.priceCents} mrpCents={product.mrpCents} /> },
    {
      key: 'status',
      header: 'Status',
      cell: (product) => <Badge variant={product.isActive ? 'success' : 'neutral'}>{product.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
  ]

  const pages = products.data ? Math.max(1, Math.ceil(products.data.total / pageSize)) : 1
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Products" actions={<Link to="/products/new" className={buttonClass({})}>New product</Link>} />
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <form role="search" aria-label="Products" noValidate onSubmit={submit} className="flex items-end gap-2">
          <FormField label="Search">
            <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          </FormField>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <FormField label="Category">
          <Select value={filters.categoryId} onChange={(event) => filter({ categoryId: event.target.value })}>
            <option value="">All categories</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Status">
          <Select value={filters.isActive} onChange={(event) => filter({ isActive: event.target.value as ProductFilters['isActive'] })}>
            <option value="">Active and inactive</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </FormField>
      </Card>
      {products.data === undefined ? (
        products.isError ? (
          <ErrorBanner message="Could not load the products." onRetry={() => void products.refetch()} />
        ) : (
          <Skeleton variant="table" count={6} />
        )
      ) : products.data.items.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No products found" description="Change the search or the filters, or create a product." />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <Table stack caption="Products" columns={columns} rows={products.data.items} rowKey={(product) => product.id} />
          </Card>
          <nav aria-label="Pages" className="flex items-center justify-between gap-4">
            <Button variant="secondary" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>
              Previous
            </Button>
            <p className="text-body text-ink tabular-nums">
              Page {filters.page} of {pages}, {products.data.total} products
            </p>
            <Button variant="secondary" disabled={filters.page >= pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>
              Next
            </Button>
          </nav>
        </>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/products/')({ component: Products })
