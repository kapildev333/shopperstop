import type { ReactNode } from 'react'
import { cn } from './cn'

export type Column<T> = {
  key: string
  header: string
  cell: (row: T) => ReactNode
}

// Simplification: some phone screen readers drop table semantics under display: block;
// the visible labels keep each value named. Ceiling: revisit if that is reported.
export function Table<T>({
  columns,
  rows,
  rowKey,
  stack,
  caption,
  className,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  stack?: boolean
  caption?: string
  className?: string
}) {
  return (
    <table className={cn('w-full bg-surface text-body', stack && 'max-sm:block', className)}>
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead className={cn(stack && 'max-sm:sr-only')}>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              scope="col"
              className="border-b border-line px-3 py-2 text-left text-small font-semibold text-ink-muted"
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className={cn(stack && 'max-sm:block')}>
        {rows.map((row) => (
          <tr key={rowKey(row)} className={cn(stack && 'max-sm:block max-sm:py-2')}>
            {columns.map((col) => (
              <td
                key={col.key}
                className={cn('border-b border-line px-3 py-2', stack && 'max-sm:block')}
              >
                {stack && (
                  <span className="block text-small font-semibold text-ink-muted sm:hidden">
                    {col.header}
                  </span>
                )}
                {col.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
