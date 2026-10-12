import type { AnchorHTMLAttributes, ButtonHTMLAttributes, Ref } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ghost-danger'
export type ButtonSize = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-control text-button transition-colors disabled:cursor-not-allowed disabled:opacity-50'

export const buttonVariantClass: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-canvas',
  ghost: 'text-accent hover:underline',
  'ghost-danger': 'text-danger hover:underline',
}

const sizeClass: Record<ButtonSize, string> = {
  md: 'h-11 px-4 sm:h-10',
  lg: 'h-12 px-6',
}

export function buttonClass({ variant = 'primary', size = 'md' }: { variant?: ButtonVariant; size?: ButtonSize }): string {
  return cn(base, buttonVariantClass[variant], sizeClass[size])
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function Button({ variant, size, loading, disabled, type = 'button', className, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading ? true : undefined}
      className={cn(buttonClass({ variant, size }), className)}
    >
      {loading && <Loader2 size={16} aria-hidden className="animate-spin" />}
      {children}
    </button>
  )
}

export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  ref?: Ref<HTMLAnchorElement>
}

export function ButtonLink({ variant, size, className, children, ...rest }: ButtonLinkProps) {
  return (
    <a {...rest} className={cn(buttonClass({ variant, size }), className)}>
      {children}
    </a>
  )
}
