import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBanner } from './error-banner'

describe('Feedback states › Error banner retries', () => {
  it('error banner retries', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ErrorBanner message="Could not load products" onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load products')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
