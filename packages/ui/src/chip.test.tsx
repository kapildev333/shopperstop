import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Chip } from './chip'

test('chip toggles', async () => {
  const onClick = vi.fn()
  const { rerender } = render(<Chip selected={false} onClick={onClick}>Dairy</Chip>)
  const chip = screen.getByRole('button', { name: 'Dairy' })
  expect(chip).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(chip)
  expect(onClick).toHaveBeenCalledTimes(1)
  rerender(<Chip selected onClick={onClick}>Dairy</Chip>)
  expect(screen.getByRole('button', { name: 'Dairy' })).toHaveAttribute('aria-pressed', 'true')
})
