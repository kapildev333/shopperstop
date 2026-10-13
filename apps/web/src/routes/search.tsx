import { Link, createFileRoute } from '@tanstack/react-router'
import { Card, EmptyState, PageHeader, buttonClass } from '@shopperstop/ui'
import { useCategories } from '../catalog'
import { ProductFeed } from '../product-feed'
import { StoreGate } from '../store-gate'

function Search() {
  const { q } = Route.useSearch()
  const title = q ? `Results for “${q}”` : 'Search'
  return (
    <StoreGate title={title}>
      {(store) => (
        <div className="flex flex-col gap-6">
          <PageHeader title={title} />
          {q ? (
            <ProductFeed
              key={q}
              storeId={store.id}
              filter={{ q }}
              empty={<Suggestions storeId={store.id} title={`No results for “${q}”`} />}
            />
          ) : (
            <Suggestions storeId={store.id} title="Search for products" />
          )}
        </div>
      )}
    </StoreGate>
  )
}

// Category links for an empty search; nothing while the categories load or fail.
function Suggestions({ storeId, title }: { storeId: string; title: string }) {
  const { data } = useCategories(storeId)
  return (
    <Card className="p-6">
      <EmptyState
        title={title}
        description="Try a category instead."
        action={
          data && (
            <ul className="flex flex-wrap justify-center gap-2">
              {data.map((parent) => (
                <li key={parent.id}>
                  <Link to="/c/$slug" params={{ slug: parent.slug }} className={buttonClass({ variant: 'secondary' })}>
                    {parent.name}
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      />
    </Card>
  )
}

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search.q === 'string' && search.q.trim() ? { q: search.q.trim() } : {},
  component: Search,
})
