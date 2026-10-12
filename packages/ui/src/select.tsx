import type { ComponentPropsWithRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './cn'
import { inputClass } from './input'

export function Select({ className, children, ...props }: ComponentPropsWithRef<'select'>) {
  return (
    <div className="relative">
      <select className={cn(inputClass, 'appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
    </div>
  )
}
