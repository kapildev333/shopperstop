import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { StatusMessage } from './status-message'

test('status message is polite', () => {
  const success = render(<StatusMessage tone="success">Saved</StatusMessage>)
  const region = screen.getByRole('status')
  expect(within(region).getByText('Saved')).toBeInTheDocument()
  expect(region.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(region).toHaveClass('bg-success-soft')
  success.unmount()

  const warning = render(<StatusMessage tone="warning">Stock is low</StatusMessage>)
  expect(warning.getByRole('status')).toHaveClass('bg-warning-soft')
})
