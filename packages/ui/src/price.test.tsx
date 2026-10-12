import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Price, formatInr } from './price'

test('price formatting', () => {
  expect(formatInr(123400)).toBe('₹1,234')
  expect(formatInr(123450)).toBe('₹1,234.50')
  expect(formatInr(12345600)).toBe('₹1,23,456')
})

test('zero rupees', () => {
  expect(formatInr(0)).toBe('₹0')
})

test('price uses tabular numerals', () => {
  const { container } = render(<Price cents={9900} />)
  expect(container.firstElementChild).toHaveClass('tabular-nums')
  expect(screen.getByText('₹99')).toHaveClass('text-accent')
})

test('discounted price shows MRP', () => {
  const { container } = render(<Price cents={9900} mrpCents={12000} />)
  expect(screen.getByText('₹99')).toBeInTheDocument()
  const mrp = container.querySelector('s')
  expect(mrp).toHaveTextContent('₹120')
  expect(mrp).toHaveTextContent('MRP')
  expect(mrp).toHaveClass('text-ink-muted')
})

test('no discount, no MRP', () => {
  const { container, rerender } = render(<Price cents={9900} mrpCents={9900} />)
  expect(container.querySelector('s')).toBeNull()
  rerender(<Price cents={9900} />)
  expect(container.querySelector('s')).toBeNull()
})
