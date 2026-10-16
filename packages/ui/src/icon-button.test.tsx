import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { X } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import type { FormEvent } from 'react'
import { IconButton } from './icon-button'

describe('IconButton has an accessible name', () => {
  it('name comes from aria-label', () => {
    const { container } = render(<IconButton aria-label="Close" icon={X} />)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('missing label does not compile', () => {
    // @ts-expect-error aria-label is required at the type level
    render(<IconButton icon={X} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('IconButton submits when asked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((e: FormEvent) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <IconButton aria-label="Save" icon={X} type="submit" />
        <IconButton aria-label="Dismiss" icon={X} />
      </form>,
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
