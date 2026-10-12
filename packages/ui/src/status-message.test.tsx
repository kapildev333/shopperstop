import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { StatusMessage } from './status-message'

test('status message is polite', () => {
  render(<StatusMessage tone="success">Saved</StatusMessage>)
  const region = screen.getByRole('status')
  expect(within(region).getByText('Saved')).toBeInTheDocument()
  expect(region.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(region).toHaveClass('bg-success-soft')
})
