import { render, screen } from '@testing-library/react'
import { ShoppingBag } from 'lucide-react'
import { expect, test } from 'vitest'
import { EmptyState } from './empty-state'

test('empty state content', () => {
  const { container } = render(
    <EmptyState
      title="Your cart is empty"
      description="Add something to start."
      icon={ShoppingBag}
      action={<button type="button">Browse</button>}
    />,
  )
  expect(screen.getByRole('heading', { level: 2, name: 'Your cart is empty' })).toBeInTheDocument()
  expect(screen.getByText('Add something to start.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Browse' })).toBeInTheDocument()
  expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})
