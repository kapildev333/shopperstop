import { render, screen } from '@testing-library/react'
import { X } from 'lucide-react'
import { describe, expect, it } from 'vitest'
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
})
