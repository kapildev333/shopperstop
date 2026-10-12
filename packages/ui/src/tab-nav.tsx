import type { ReactNode } from 'react'
import { cn } from './cn'

// Router-agnostic: TanStack Router's Link sets aria-current="page" on the active link; plain anchors set it by hand.
export function TabNav({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        'flex gap-4 border-b border-line [&_a]:border-b-2 [&_a]:border-transparent [&_a]:py-3 [&_a]:text-body [&_a]:text-ink-muted [&_a[aria-current=page]]:border-accent [&_a[aria-current=page]]:font-semibold [&_a[aria-current=page]]:text-accent',
        className,
      )}
    >
      {children}
    </nav>
  )
}
