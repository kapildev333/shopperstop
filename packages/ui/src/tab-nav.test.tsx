import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { TabNav } from './tab-nav'

test('tab navigation landmark', () => {
  render(
    <TabNav label="Order views">
      <a href="/orders/live">Live</a>
      <a href="/orders/history" aria-current="page">History</a>
    </TabNav>,
  )
  const nav = screen.getByRole('navigation', { name: 'Order views' })
  expect(within(nav).getByRole('link', { name: 'Live' })).toHaveAttribute('href', '/orders/live')
  const current = within(nav).getByRole('link', { name: 'History' })
  expect(current).toHaveAttribute('aria-current', 'page')
})
