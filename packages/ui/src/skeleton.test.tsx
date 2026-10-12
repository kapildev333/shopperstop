import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Skeleton } from './skeleton'

test('skeleton count', () => {
  const { unmount } = render(<Skeleton variant="grid" />)
  const status = screen.getByRole('status', { name: 'Loading' })
  expect(status.querySelectorAll('[data-skeleton]')).toHaveLength(6)
  unmount()

  render(<Skeleton variant="list" count={3} />)
  expect(screen.getByRole('status', { name: 'Loading' }).querySelectorAll('[data-skeleton]')).toHaveLength(3)
})
