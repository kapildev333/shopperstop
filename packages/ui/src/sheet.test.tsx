import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Sheet } from './sheet'

describe('Sheet closes on Escape and on its close button', () => {
  it('sheet closes on Escape and on its close button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Cart">
        <p>Your items</p>
      </Sheet>,
    )
    expect(screen.getByRole('dialog', { name: 'Cart' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('Sheet placement', () => {
  it('placement classes', () => {
    render(
      <Sheet open onClose={() => {}} title="Cart">
        <p>Your items</p>
      </Sheet>,
    )
    expect(screen.getByRole('dialog', { name: 'Cart' })).toHaveClass('bottom-0', 'sm:right-0', 'shadow-sheet', 'duration-200')
  })
})
