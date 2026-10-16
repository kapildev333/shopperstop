import { render, screen } from '@testing-library/react'
import { X } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { Button, VisuallyHidden } from './index'

describe('VisuallyHidden', () => {
  it('hidden text names a control', () => {
    render(
      <Button variant="ghost">
        <X size={20} aria-hidden />
        <VisuallyHidden>Close</VisuallyHidden>
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(screen.getByText('Close')).toHaveClass('sr-only')
  })

  it('live variant is polite', () => {
    render(
      <>
        <VisuallyHidden live>3 new orders</VisuallyHidden>
        <VisuallyHidden>Plain</VisuallyHidden>
      </>,
    )
    const live = screen.getByText('3 new orders')
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toHaveClass('sr-only')
    expect(screen.getByText('Plain')).not.toHaveAttribute('aria-live')
  })
})
