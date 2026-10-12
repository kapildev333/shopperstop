import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

export function Chip({
  selected,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      aria-pressed={selected}
      className={cn(
        'h-11 rounded-full border px-4 text-body transition-colors sm:h-9',
        selected ? 'border-accent bg-accent-soft text-accent-hover' : 'border-line-strong bg-surface text-ink',
        className,
      )}
    />
  )
}
