import { cn } from '@shopperstop/ui'

// A 1:1 image tile; the placeholder stands in until an image is uploaded.
// ponytail: an app-level recipe with an empty placeholder (no icon: lucide-react is not an apps/admin dependency); replace with the packages/ui ImageTile when ui adds it.
export function ImageTile({ src, alt = '', className }: { src?: string; alt?: string; className?: string }) {
  return (
    <div className={cn('aspect-square shrink-0 overflow-hidden rounded-control border border-line bg-surface', className)}>
      {src ? (
        <img src={src} alt={alt} className="size-full object-contain" />
      ) : (
        <div data-placeholder className="size-full bg-canvas" />
      )}
    </div>
  )
}
