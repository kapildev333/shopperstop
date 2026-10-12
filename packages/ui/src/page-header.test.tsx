import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { PageHeader } from './page-header'

test('page header', () => {
  render(
    <PageHeader
      title="Orders"
      description="Live orders from this store."
      actions={<button type="button">Refresh</button>}
    />,
  )
  const headings = screen.getAllByRole('heading', { level: 1 })
  expect(headings).toHaveLength(1)
  expect(headings[0]).toHaveTextContent('Orders')
  expect(headings[0]).toHaveClass('text-h1')
  expect(screen.getByText('Live orders from this store.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
})
