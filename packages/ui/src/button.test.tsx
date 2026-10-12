import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button, ButtonLink, buttonClass } from './button'

describe('Button variants and loading', () => {
  it('default type is button', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Button>Save</Button>
      </form>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('loading blocks clicks', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('primary uses the accent', () => {
    render(<Button>Add</Button>)
    const button = screen.getByRole('button', { name: 'Add' })
    expect(button).toHaveClass('bg-accent', 'text-on-accent')
  })

  it('link keeps href and button style', () => {
    render(
      <ButtonLink href="/cart" variant="secondary">
        Cart
      </ButtonLink>,
    )
    const link = screen.getByRole('link', { name: 'Cart' })
    expect(link).toHaveAttribute('href', '/cart')
    expect(link.className).toBe(buttonClass({ variant: 'secondary' }))
    expect(link).toHaveClass('border-line-strong', 'bg-surface', 'text-ink')
  })
})
