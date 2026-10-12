import { render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { expect, test } from 'vitest'
import { routeTree } from './routeTree.gen'

function renderAt(path: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) })
  render(<RouterProvider router={router} />)
}

test('home renders in the shell', async () => {
  renderAt('/')
  expect(await screen.findByRole('heading', { level: 1, name: 'Groceries in minutes' })).toBeInTheDocument()
  const banner = screen.getByRole('banner')
  expect(banner).toHaveTextContent('ShopperStop')
  expect(within(banner).getByRole('button', { name: 'Enter pincode' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Set your pincode' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
})

test('unknown customer path', async () => {
  renderAt('/nope')
  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(screen.getByRole('banner')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Nothing at this address' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/')
})
