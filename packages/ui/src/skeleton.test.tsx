import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Skeleton } from './skeleton'

test('skeleton count', () => {
  const { unmount } = render(<Skeleton variant="grid" />)
  const status = screen.getByRole('status', { name: 'Loading' })
  expect(status).toHaveClass('grid-cols-2')
  const placeholders = status.querySelectorAll('[data-skeleton]')
  expect(placeholders).toHaveLength(6)
  for (const p of placeholders) {
    expect(p).toHaveAttribute('aria-hidden', 'true')
  }
  unmount()

  render(<Skeleton variant="list" count={3} />)
  expect(screen.getByRole('status', { name: 'Loading' }).querySelectorAll('[data-skeleton]')).toHaveLength(3)
})
