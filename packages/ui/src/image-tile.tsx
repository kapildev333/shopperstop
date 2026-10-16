import { ShoppingBasket } from 'lucide-react'
import { cn } from './cn'

// alt="" marks the tile decorative (the HTML convention); alt is required so omitting it is a compile error.
export type ImageTileProps = { src?: string; alt: string; className?: string }

export function ImageTile({ src, alt, className }: ImageTileProps) {
  return (
    <div className={cn('aspect-square shrink-0 overflow-hidden rounded-control bg-surface', className)}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="size-full object-contain" />
      ) : (
        <div data-placeholder className="flex size-full items-center justify-center bg-canvas">
          <ShoppingBasket size={20} aria-hidden className="text-ink-muted" />
        </div>
      )}
    </div>
  )
}
