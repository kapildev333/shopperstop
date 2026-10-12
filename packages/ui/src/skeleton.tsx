import { cn } from './cn'

const layouts = {
  grid: { container: 'grid grid-cols-2 gap-3 sm:grid-cols-4', item: 'aspect-square rounded-card' },
  list: { container: 'flex flex-col gap-3', item: 'h-16 rounded-card' },
  table: { container: 'flex flex-col gap-2', item: 'h-10 rounded-control' },
} as const

export function Skeleton({
  variant,
  count = 6,
  className,
}: {
  variant: keyof typeof layouts
  count?: number
  className?: string
}) {
  const layout = layouts[variant]
  return (
    <div role="status" aria-label="Loading" className={cn(layout.container, className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden data-skeleton className={cn('animate-pulse bg-line', layout.item)} />
      ))}
    </div>
  )
}
