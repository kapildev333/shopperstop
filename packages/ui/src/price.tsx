import type { HTMLAttributes } from 'react'
import { cn } from './cn'
import { formatInr } from './format'

export { formatInr } from './format'

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
