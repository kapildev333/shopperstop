import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'accent'

const surface: Record<BadgeVariant, string> = {
  neutral: 'bg-canvas',
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  accent: 'bg-accent-soft',
}

export function Badge({
  variant = 'neutral',
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      {...rest}
      className={cn('inline-flex items-center rounded-full px-2 text-small font-semibold text-ink', surface[variant], className)}
    />
  )
}
