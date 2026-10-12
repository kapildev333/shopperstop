import type { HTMLAttributes } from 'react'
import { cn } from './cn'

// Whole rupees print without decimals; paise print with two. Full ICU is required (Node and every browser ship it).
export function formatInr(cents: number): string {
  const f = cents % 100 === 0 ? 0 : 2
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: f,
    maximumFractionDigits: f,
  }).format(cents / 100)
}

export function Price({
  cents,
  mrpCents,
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { cents: number; mrpCents?: number }) {
  return (
    <span {...rest} className={cn('inline-flex items-baseline gap-1 tabular-nums', className)}>
      <span className="font-semibold text-accent">{formatInr(cents)}</span>
      {mrpCents !== undefined && mrpCents > cents && (
        <s className="text-small text-ink-muted">
          <span className="sr-only">MRP </span>
          {formatInr(mrpCents)}
        </s>
      )}
    </span>
  )
}
