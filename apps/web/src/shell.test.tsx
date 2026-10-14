import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { queryClient } from './api'
import { keys } from './catalog'
import { setPincode } from './pincode'
import { renderAt, store } from './test-data'

test('home renders in the shell', async () => {
  renderAt('/')
  expect(await screen.findByRole('heading', { level: 1, name: 'Groceries in minutes' })).toBeInTheDocument()
  const banner = screen.getByRole('banner')
  expect(banner).toHaveTextContent('ShopperStop')
  expect(within(banner).getByRole('link', { name: 'ShopperStop' })).toHaveAttribute('href', '/')
  expect(within(banner).getByRole('searchbox', { name: 'Search products' })).toBeInTheDocument()
  expect(within(banner).getByRole('button', { name: 'Enter pincode' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Set your pincode' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
})

test('search from the banner', async () => {
  setPincode('560034')
  queryClient.setQueryData(keys.serviceability('560034'), store())
  const router = renderAt('/')
  const user = userEvent.setup()
  const search = await screen.findByRole('searchbox', { name: 'Search products' })
  await user.type(search, '  milk {enter}')
  expect(router.state.location.href).toBe('/search?q=milk')
})

test('unknown customer path', async () => {
  renderAt('/nope')
  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(screen.getByRole('banner')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Nothing at this address' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/')
})
