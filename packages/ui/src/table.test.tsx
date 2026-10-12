import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Table, type Column } from './table'

type Line = { id: string; name: string; qty: number }

const columns: Column<Line>[] = [
  { key: 'name', header: 'Product', cell: (r) => r.name },
  { key: 'qty', header: 'Quantity', cell: (r) => String(r.qty) },
]
const rows: Line[] = [
  { id: 'a', name: 'Milk', qty: 2 },
  { id: 'b', name: 'Bread', qty: 1 },
]

test('rows and headers render', () => {
  render(<Table columns={columns} rows={rows} rowKey={(r) => r.id} />)
  expect(screen.getAllByRole('columnheader')).toHaveLength(2)
  const body = screen.getByRole('table').querySelector('tbody')!
  expect(within(body as HTMLElement).getAllByRole('row')).toHaveLength(2)
  expect(screen.getByRole('cell', { name: 'Milk' })).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: '1' })).toBeInTheDocument()
})

test('stack labels cells', () => {
  const { unmount } = render(<Table columns={columns} rows={rows} rowKey={(r) => r.id} stack />)
  const stacked = screen.getAllByRole('cell')
  expect(stacked[0]).toHaveTextContent('Product')
  expect(stacked[1]).toHaveTextContent('Quantity')
  unmount()

  render(<Table columns={columns} rows={rows} rowKey={(r) => r.id} />)
  expect(screen.getAllByRole('cell')[0]).not.toHaveTextContent('Product')
})
