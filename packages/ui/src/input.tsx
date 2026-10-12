import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

export const inputClass =
  'h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-body text-ink placeholder:text-ink-muted aria-[invalid=true]:border-danger disabled:opacity-50 sm:h-10'

export function Input({ className, ...props }: ComponentPropsWithRef<'input'>) {
  return <input className={cn(inputClass, className)} {...props} />
}
