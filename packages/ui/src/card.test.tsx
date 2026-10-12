import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Card } from './card'

test('card classes', () => {
  render(<Card className="p-4">body</Card>)
  const card = screen.getByText('body')
  for (const c of ['bg-surface', 'border-line', 'rounded-card', 'shadow-card', 'p-4']) {
    expect(card).toHaveClass(c)
  }
})
