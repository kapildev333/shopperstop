import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export type VisuallyHiddenProps = HTMLAttributes<HTMLSpanElement> & { live?: boolean }

// A live region must stay mounted while its text changes: render it always and change its children,
// otherwise assistive technology does not announce the first text it receives.
export function VisuallyHidden({ live, className, ...rest }: VisuallyHiddenProps) {
  return <span aria-live={live ? 'polite' : undefined} {...rest} className={cn('sr-only', className)} />
}
