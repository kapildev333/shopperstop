import { render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { expect, test } from 'vitest'
import { routeTree } from './routeTree.gen'

function renderAt(path: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) })
  render(<RouterProvider router={router} />)
}

test('dashboard renders in the shell', async () => {
  renderAt('/')
  expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  expect(screen.getByRole('banner')).toHaveTextContent('ShopperStop Admin')
  const nav = screen.getByRole('navigation', { name: 'Admin' })
  expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
})

test('unknown path', async () => {
  renderAt('/nope')
  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(screen.getByRole('banner')).toBeInTheDocument()
})
