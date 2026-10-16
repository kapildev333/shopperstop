import { useEffect, useRef, type RefObject } from 'react'

const focusable =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Open modal panels, bottom to top. Only the top layer handles Escape and Tab, so a Dialog
// opened from a Sheet closes first and keeps focus inside itself. Module-level: one page, one stack.
const layers: HTMLElement[] = []

// Internal to the package: Dialog and Sheet share it. Not exported from index.ts.
export function useModal(open: boolean, onClose: () => void): RefObject<HTMLDivElement | null> {
  const panelRef = useRef<HTMLDivElement | null>(null)
  // Kept in a ref so an inline onClose does not re-run the focus effect on every render.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const panel = panelRef.current
    if (!open || !panel) return
    const previous = document.activeElement as HTMLElement | null
    const items = () => Array.from(panel.querySelectorAll<HTMLElement>(focusable))
    layers.push(panel)
    ;(items()[0] ?? panel).focus()

    function onKeyDown(event: KeyboardEvent) {
      if (layers[layers.length - 1] !== panel) return
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const list = items()
      if (list.length === 0) {
        event.preventDefault()
        return
      }
      const first = list[0]
      const last = list[list.length - 1]
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      layers.splice(layers.indexOf(panel), 1)
      previous?.focus()
    }
  }, [open])

  return panelRef
}
