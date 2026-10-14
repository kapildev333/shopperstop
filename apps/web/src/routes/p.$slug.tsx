import type { ReactNode } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Price,
  Skeleton,
  Stepper,
  buttonClass,
  formatInr,
} from '@shopperstop/ui'
import { useCartQuantity } from '../cart'
import { useProduct, type StoreProduct } from '../catalog'
import { ImageTile } from '../product-card'
import { StoreGate } from '../store-gate'

function ProductPage() {
  const { slug } = Route.useParams()
  return <StoreGate title="Product">{(store) => <ProductContent storeId={store.id} slug={slug} />}</StoreGate>
}

function ProductContent({ storeId, slug }: { storeId: string; slug: string }) {
  const { data, error, refetch } = useProduct(storeId, slug)
  // A failed refetch keeps the product on screen; the alert shows only with nothing held.
  if (data === undefined) {
    return (
      <Frame title="Product">
        {error ? (
          <ErrorBanner message="Could not load this product." onRetry={() => refetch()} />
        ) : (
          <Skeleton variant="list" count={3} />
        )}
      </Frame>
    )
  }
  if (!data) {
    return (
      <Frame title="Product not found">
        <Card className="p-6">
          <EmptyState
            title="Nothing here"
            description="It may have been removed."
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
  return <ProductDetail product={data} />
}

function ProductDetail({ product }: { product: StoreProduct }) {
  const [quantity, setQuantity] = useCartQuantity(product)
  const saving = product.mrpCents - product.priceCents
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="max-w-md">
        <ImageTile src={product.imageUrl} />
      </div>
      <Card className="flex flex-col gap-3 p-6">
        <PageHeader title={product.name} description={product.unitLabel} />
        <div className="flex flex-wrap items-center gap-2">
          <Price className="text-h2" cents={product.priceCents} mrpCents={product.mrpCents} />
          {saving > 0 && <Badge variant="accent">{`Save ${formatInr(saving)}`}</Badge>}
        </div>
        {product.inStock && (
          <p className="text-small text-ink-muted">
            {product.quantity >= 10 ? '10+ left' : `Only ${product.quantity} left`}
          </p>
        )}
        <div>
          <Stepper value={quantity} max={product.inStock ? product.quantity : 0} label={product.name} onChange={setQuantity} />
        </div>
        {product.description && <p className="text-body text-ink">{product.description}</p>}
      </Card>
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

export const Route = createFileRoute('/p/$slug')({
  component: ProductPage,
})
