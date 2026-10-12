import { render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { expect, test } from 'vitest'
import { routeTree } from './routeTree.gen'

function renderAt(path: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) })
  render(<RouterProvider router={router} />)
  return router
}

test('signed-out header', async () => {
  renderAt('/')
  const banner = await screen.findByRole('banner')
  expect(within(banner).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in?returnTo=%2F')
})

test('signed-out account redirect', async () => {
  const router = renderAt('/account')
  expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
  expect(router.state.location.href).toBe('/sign-in?returnTo=%2Faccount')
})
