import { Minus, Plus } from 'lucide-react'
// Simplification: an out-of-stock cart line cannot be decremented here; the cart drawer offers its own remove action.
export function Stepper({
  value,
  max,
  label,
  onChange,
}: {
  value: number
  max: number
  label: string
  onChange: (next: number) => void
}) {
  if (max <= 0) {
    return (
      <button type="button" disabled className="h-11 min-w-20 rounded-full border border-line-strong bg-surface px-4 text-button text-ink-muted disabled:cursor-not-allowed sm:h-9">
        Out of stock
      </button>
    )
  }
  if (value === 0) {
    return (
      <button
        type="button"
        aria-label={`Add ${label}`}
        onClick={() => onChange(1)}
        className="h-11 min-w-20 rounded-full border border-accent bg-surface px-4 text-button text-accent sm:h-9"
      >
        ADD
      </button>
    )
  }
  return (
    <div
      role="group"
      aria-label={`Quantity of ${label}`}
      className="inline-flex h-11 items-center rounded-full bg-accent text-on-accent sm:h-9"
    >
      <button
        type="button"
        aria-label={`Remove one ${label}`}
        onClick={() => onChange(value - 1)}
        className="inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-accent-hover sm:size-9"
      >
        <Minus size={16} aria-hidden />
      </button>
      <span aria-live="polite" className="min-w-6 text-center tabular-nums">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Add one ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:size-9"
      >
        <Plus size={16} aria-hidden />
      </button>
    </div>
  )
}
