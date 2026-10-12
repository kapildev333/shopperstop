import { useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from './cn'
import { IconButton } from './icon-button'
import { useModal } from './use-modal'

export type SheetProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}

export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const titleId = useId()
  const panelRef = useModal(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 bg-ink/40">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'fixed inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-card bg-surface shadow-sheet transition-transform duration-200 starting:translate-y-full sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-card sm:starting:translate-x-full sm:starting:translate-y-0',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id={titleId} className="text-h3">
            {title}
          </h2>
          <IconButton aria-label="Close" icon={X} onClick={onClose} />
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
