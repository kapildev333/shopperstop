import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 text-center', className)}>
      {Icon && <Icon size={20} aria-hidden className="text-ink-muted" />}
      <h2 className="text-h2 text-ink">{title}</h2>
      {description && <p className="text-body text-ink-muted">{description}</p>}
      {action}
    </div>
  )
}
