import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

type StatusTone = 'neutral' | 'success' | 'warning'

const tones: Record<StatusTone, { icon: LucideIcon; bg: string; iconClass: string }> = {
  neutral: { icon: Info, bg: 'bg-canvas', iconClass: 'text-ink-muted' },
  success: { icon: CheckCircle2, bg: 'bg-success-soft', iconClass: 'text-success' },
  warning: { icon: AlertTriangle, bg: 'bg-warning-soft', iconClass: 'text-warning' },
}

export function StatusMessage({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: StatusTone
  children: ReactNode
  className?: string
}) {
  const { icon: Icon, bg, iconClass } = tones[tone]
  return (
    <div
      role="status"
      className={cn('flex items-center gap-2 rounded-control px-3 py-2 text-body text-ink', bg, className)}
    >
      <Icon size={16} aria-hidden className={iconClass} />
      {children}
    </div>
  )
}
