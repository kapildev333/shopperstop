import { useEffect, useState, type ReactNode } from 'react'
import { Badge, Price } from '@shopperstop/ui'
import { arrival, statusName, statusVariant, type OrderStatus } from './orders'
import { ImageTile } from './product-card'

// One read-only line: picture, name, unit, quantity and its total. Cart lines and order items both fit it;
// children go under the text (checkout puts its out-of-stock mark there), so they wrap instead of leaving the card.
export function LineRow({
  name,
  unitLabel,
  imageUrl,
  priceCents,
  quantity,
  children,
}: {
  name: string
  unitLabel: string
  imageUrl?: string
  priceCents: number
  quantity: number
  children?: ReactNode
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="w-14 shrink-0">
        <ImageTile src={imageUrl} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-ink">{name}</p>
        <p className="text-small text-ink-muted">{unitLabel}</p>
        <p className="text-small text-ink-muted">Qty {quantity}</p>
        {children}
      </div>
      <Price cents={priceCents * quantity} />
    </li>
  )
}

// The status as text in a badge: the colour never carries it alone.
export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={statusVariant(status)}>{statusName(status)}</Badge>
}

// The minutes left, counted from Date.now() once a second. Outside the status message, so a minute changing is not announced.
export function Countdown({ placedAt, promisedMinutes }: { placedAt: string; promisedMinutes: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return <p className="text-h3 text-ink">{arrival(placedAt, promisedMinutes, now)}</p>
}
