import { render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { TabNav } from './tab-nav'

test('tab navigation landmark', () => {
  render(
    <TabNav label="Order views">
      <a href="/orders/live">Live</a>
      <a href="/orders/history" aria-current="page">History</a>
    </TabNav>,
  )
  const nav = screen.getByRole('navigation', { name: 'Order views' })
  expect(nav).toHaveClass('[&_a[aria-current=page]]:text-accent')
  expect(within(nav).getByRole('link', { name: 'Live' })).toHaveAttribute('href', '/orders/live')
  const current = within(nav).getByRole('link', { name: 'History' })
  expect(current).toHaveAttribute('aria-current', 'page')
})

test('tab navigation scrolls instead of wrapping', () => {
  render(
    <TabNav label="Admin">
      <a href="/admin/orders">Orders</a>
      <a href="/admin/live">Live</a>
      <a href="/admin/stores">Stores</a>
      <a href="/admin/products">Products</a>
      <a href="/admin/stock">Stock</a>
      <a href="/admin/staff">Staff</a>
      <a href="/admin/reports" aria-current="page">Reports</a>
    </TabNav>,
  )
  const nav = screen.getByRole('navigation', { name: 'Admin' })
  expect(nav).toHaveClass(
    'overflow-x-auto',
    'whitespace-nowrap',
    '[&_a]:shrink-0',
    '[&_a:focus-visible]:outline-offset-[-2px]',
    '[&_a[aria-current=page]]:text-accent',
  )
  expect(within(nav).getAllByRole('link')).toHaveLength(7)
})

test('tab navigation reveals the current link', () => {
  const original = Element.prototype.scrollIntoView
  const scrollIntoView = vi.fn()
  Element.prototype.scrollIntoView = scrollIntoView
  try {
    render(
      <TabNav label="Admin">
        <a href="/admin/orders">Orders</a>
        <a href="/admin/live">Live</a>
        <a href="/admin/stores">Stores</a>
        <a href="/admin/products">Products</a>
        <a href="/admin/stock">Stock</a>
        <a href="/admin/staff">Staff</a>
        <a href="/admin/reports" aria-current="page">Reports</a>
      </TabNav>,
    )
    const current = screen.getByRole('link', { name: 'Reports' })
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(current)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
  } finally {
    Element.prototype.scrollIntoView = original
  }
})
