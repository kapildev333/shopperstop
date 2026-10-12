import { useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './button'
import { cn } from './cn'
import { useModal } from './use-modal'

export type DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const titleId = useId()
  const panelRef = useModal(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn('w-full max-w-md rounded-card bg-surface p-6 shadow-sheet', className)}
      >
        <h2 id={titleId} className="text-h2 text-ink">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export type DialogFooterProps = {
  onCancel: () => void
  cancelLabel?: string
  children?: ReactNode
  className?: string
}

export function DialogFooter({ onCancel, cancelLabel, children, className }: DialogFooterProps) {
  return (
    <div className={cn('mt-6 flex justify-end gap-2', className)}>
      <Button variant="secondary" onClick={onCancel}>
        {cancelLabel ?? 'Cancel'}
      </Button>
      {children}
    </div>
  )
}
