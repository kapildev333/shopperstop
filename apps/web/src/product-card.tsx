import { Link } from '@tanstack/react-router'
import { ShoppingBasket } from 'lucide-react'
import { Card, Price, Stepper } from '@shopperstop/ui'
import { useCartQuantity } from './cart'
import type { StoreProduct } from './catalog'

// Alt is empty: the name beside the tile is the link's text.
export function ImageTile({ src }: { src?: string }) {
  return (
    <div className="aspect-square w-full overflow-hidden rounded-control bg-surface">
      {src ? (
        <img src={src} alt="" loading="lazy" className="size-full object-contain" />
      ) : (
        <div data-placeholder className="flex size-full items-center justify-center bg-canvas">
          <ShoppingBasket size={20} aria-hidden className="text-ink-muted" />
        </div>
      )}
    </div>
  )
}

export function ProductCard({ product }: { product: StoreProduct }) {
  const [quantity, setQuantity] = useCartQuantity(product)
  return (
    <Card className="flex flex-col gap-2 p-3">
      <Link to="/p/$slug" params={{ slug: product.slug }} className="flex flex-col gap-2">
        <ImageTile src={product.imageUrl} />
        <p className="line-clamp-2 text-body font-semibold text-ink">{product.name}</p>{' '}
        <p className="text-small text-ink-muted">{product.unitLabel}</p>
      </Link>
      <div className="flex items-center justify-between gap-2">
        <Price cents={product.priceCents} mrpCents={product.mrpCents} />
        <Stepper
          value={quantity}
          max={product.inStock ? product.quantity : 0}
          label={product.name}
          onChange={setQuantity}
        />
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
