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

  it('compact size keeps the phone tap target', () => {
    render(
      <>
        <Button size="compact">Order</Button>
        <ButtonLink href="/orders/1" size="compact">
          Open
        </ButtonLink>
      </>,
    )
    for (const element of [screen.getByRole('button', { name: 'Order' }), screen.getByRole('link', { name: 'Open' })]) {
      expect(element).toHaveClass('h-11', 'sm:h-8', 'px-2')
      expect(element).not.toHaveClass('sm:h-10')
      expect(element).not.toHaveClass('px-4')
    }
  })
})

describe('Unavailable buttons stay focusable', () => {
  it('aria-disabled looks disabled and keeps focus', async () => {
    render(
      <>
        <Button aria-disabled="true">Pack</Button>
        <ButtonLink href="/print" aria-disabled="true">
          Print
        </ButtonLink>
      </>,
    )
    const button = screen.getByRole('button', { name: 'Pack' })
    const link = screen.getByRole('link', { name: 'Print' })
    for (const element of [button, link]) {
      expect(element).toHaveClass('aria-disabled:opacity-50', 'aria-disabled:cursor-not-allowed')
    }
    expect(button).not.toBeDisabled()
    expect(button).not.toHaveAttribute('disabled')
    await userEvent.tab()
    expect(button).toHaveFocus()
    await userEvent.tab()
    expect(link).toHaveFocus()
  })
})
