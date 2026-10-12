import { AlertCircle } from 'lucide-react'
import { Button } from './button'
import { cn } from './cn'

export type ErrorBannerProps = {
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorBanner({ message, onRetry, className }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-center gap-3 rounded-control border border-danger bg-danger-soft px-3 py-2 text-body text-ink',
        className,
      )}
    >
      <AlertCircle size={20} aria-hidden className="text-danger" />
      {message}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
