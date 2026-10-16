import { createContext, use, type KeyboardEvent, type ReactNode } from 'react'
import { chipClass } from './chip'
import { cn } from './cn'

type GroupState = { value: string | undefined; onChange: (value: string) => void }

const ChoiceGroupContext = createContext<GroupState | null>(null)

const ARROW_STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

export function ChoiceGroup({
  label,
  value,
  onChange,
  children,
  className,
}: {
  label: string
  value?: string
  onChange: (value: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <ChoiceGroupContext value={{ value, onChange }}>
      <div role="radiogroup" aria-label={label} className={className}>
        {children}
      </div>
    </ChoiceGroupContext>
  )
}

export function Choice({
  value,
  children,
  className,
}: {
  value: string
  children: ReactNode
  className?: string
}) {
  const group = use(ChoiceGroupContext)
  if (!group) throw new Error('Choice must be inside a ChoiceGroup')
  const checked = group.value === value

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const step = ARROW_STEP[event.key]
    if (step === undefined) return
    const radios = Array.from(
      event.currentTarget.closest('[role="radiogroup"]')!.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    )
    const next = radios[(radios.indexOf(event.currentTarget) + step + radios.length) % radios.length]
    event.preventDefault()
    next.focus()
    next.click()
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      tabIndex={checked || group.value === undefined ? 0 : -1}
      onClick={() => group.onChange(value)}
      onKeyDown={onKeyDown}
      className={cn(chipClass(checked), className)}
    >
      {children}
    </button>
  )
}
