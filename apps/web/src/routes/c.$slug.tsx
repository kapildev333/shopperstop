import type { ReactNode } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Card, Chip, EmptyState, ErrorBanner, PageHeader, Skeleton, buttonClass } from '@shopperstop/ui'
import { findCategory, useCategories, type CategoryNode } from '../catalog'
import { ProductFeed } from '../product-feed'
import { StoreGate } from '../store-gate'

function CategoryPage() {
  const { slug } = Route.useParams()
  return <StoreGate title="Category">{(store) => <CategoryContent storeId={store.id} slug={slug} />}</StoreGate>
}

function CategoryContent({ storeId, slug }: { storeId: string; slug: string }) {
  const { data, error, refetch } = useCategories(storeId)
  if (error) {
    return (
      <Frame title="Category">
        <ErrorBanner message="Could not load categories." onRetry={() => refetch()} />
      </Frame>
    )
  }
  if (!data) {
    return (
      <Frame title="Category">
        <Skeleton variant="grid" count={8} />
      </Frame>
    )
  }
  const found = findCategory(data, slug)
  if (!found) {
    return (
      <Frame title="Category not found">
        <Card className="p-6">
          <EmptyState
            title="Nothing here"
            description="This store has nothing in this category right now."
            action={
              <Link to="/" className={buttonClass({ variant: 'secondary' })}>
                Go to Home
              </Link>
            }
          />
        </Card>
      </Frame>
    )
  }
  const { parent, selected } = found
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={parent.name} />
      <Tabs parent={parent} selected={selected.id} />
      <ProductFeed
        key={selected.id}
        storeId={storeId}
        filter={{ categoryId: selected.id }}
        empty={
          <Card className="p-6">
            <EmptyState title="Nothing here yet" />
          </Card>
        }
      />
    </div>
  )
}

// Each tab is a URL, so a subcategory is shareable and Back works.
function Tabs({ parent, selected }: { parent: CategoryNode; selected: string }) {
  const navigate = useNavigate()
  const tabs = [{ id: parent.id, slug: parent.slug, name: 'All' }, ...parent.children]
  return (
    <div role="group" aria-label="Subcategories" className="flex gap-2 overflow-x-auto">
      {tabs.map((tab) => (
        <Chip
          key={tab.id}
          selected={tab.id === selected}
          onClick={() => navigate({ to: '/c/$slug', params: { slug: tab.slug } })}
        >
          {tab.name}
        </Chip>
      ))}
    </div>
  )
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      {children}
    </div>
  )
}

export const Route = createFileRoute('/c/$slug')({
  component: CategoryPage,
})
