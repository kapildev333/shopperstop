import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Badge } from './badge'

test('badge variant surface', () => {
  render(<Badge variant="danger">Out</Badge>)
  expect(screen.getByText('Out')).toHaveClass('bg-danger-soft', 'text-ink')
})
