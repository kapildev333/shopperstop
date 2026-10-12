import type { ButtonHTMLAttributes, Ref } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from './cn'
import { buttonVariantClass } from './button'

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  'aria-label': string
  icon: LucideIcon
  variant?: 'ghost' | 'secondary'
  ref?: Ref<HTMLButtonElement>
}

export function IconButton({ icon: Icon, variant = 'ghost', className, ...rest }: IconButtonProps) {
  const variantClass = variant === 'ghost' ? 'text-ink hover:bg-canvas' : buttonVariantClass.secondary
  return (
    <button
      {...rest}
      type="button"
      className={cn('inline-flex size-11 items-center justify-center rounded-control sm:size-10', variantClass, className)}
    >
      <Icon size={20} aria-hidden />
    </button>
  )
}
