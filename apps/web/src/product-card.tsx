import { Link } from '@tanstack/react-router'
import { Card, ErrorBanner, ImageTile, Price, Stepper } from '@shopperstop/ui'
import { useCartQuantity } from './cart'
import type { StoreProduct } from './catalog'

export function ProductCard({ product }: { product: StoreProduct }) {
  const [quantity, setQuantity, failure] = useCartQuantity(product)
  return (
    <Card className="flex flex-col gap-2 p-3">
      <Link to="/p/$slug" params={{ slug: product.slug }} className="flex flex-col gap-2">
        <ImageTile src={product.imageUrl} alt="" className="w-full" />
        <p className="line-clamp-2 text-body font-semibold text-ink">{product.name}</p>{' '}
        <p className="text-small text-ink-muted">{product.unitLabel}</p>
      </Link>
      <div className="flex flex-col items-start gap-2">
        <Price cents={product.priceCents} mrpCents={product.mrpCents} />
        <Stepper
          value={quantity}
          max={product.inStock ? product.quantity : 0}
          label={product.name}
          onChange={setQuantity}
        />
        {failure && <ErrorBanner message={failure} />}
      </div>
    </Card>
  )
}

export function ProductGrid({ products }: { products: StoreProduct[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  )
}
