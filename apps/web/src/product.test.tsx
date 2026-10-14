import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { queryClient } from './api'
import { keys } from './catalog'
import { setPincode } from './pincode'
import { product, renderAt, store } from './test-data'

function seedStore() {
  setPincode('560034')
  queryClient.setQueryData(keys.serviceability('560034'), store())
}

test('product with savings', async () => {
  seedStore()
  queryClient.setQueryData(
    keys.product(store().id, 'amul-curd'),
    product({
      id: '00000000-0000-4000-8000-000000000602',
      name: 'Amul Curd',
      slug: 'amul-curd',
      unitLabel: '400 g',
      priceCents: 4800,
      mrpCents: 6000,
      quantity: 3,
      inStock: true,
      description: 'Set curd, cultured daily.',
    }),
  )
  renderAt('/p/amul-curd')

  expect(await screen.findByRole('heading', { level: 1, name: 'Amul Curd' })).toBeInTheDocument()
  expect(screen.getByText('400 g')).toBeInTheDocument()
  expect(screen.getByText('₹48')).toBeInTheDocument()
  expect(screen.getByText('₹60').tagName).toBe('S')
  expect(screen.getByText('Save ₹12')).toBeInTheDocument()
  expect(screen.getByText('Only 3 left')).toBeInTheDocument()
  expect(screen.getByText('Set curd, cultured daily.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add Amul Curd' })).toBeEnabled()
})

test('plenty in stock', async () => {
  seedStore()
  queryClient.setQueryData(keys.product(store().id, 'amul-taaza'), product({ name: 'Amul Taaza', quantity: 10 }))
  renderAt('/p/amul-taaza')

  expect(await screen.findByRole('heading', { level: 1, name: 'Amul Taaza' })).toBeInTheDocument()
  expect(screen.getByText('10+ left')).toBeInTheDocument()
})

test('out of stock product', async () => {
  seedStore()
  queryClient.setQueryData(
    keys.product(store().id, 'amul-taaza'),
    product({ name: 'Amul Taaza', inStock: false, quantity: 0 }),
  )
  renderAt('/p/amul-taaza')

  expect(await screen.findByRole('heading', { level: 1, name: 'Amul Taaza' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Add Amul Taaza' })).not.toBeInTheDocument()
  expect(screen.queryByText(/left$/)).not.toBeInTheDocument()
})

test('no savings badge when the MRP is not higher', async () => {
  seedStore()
  queryClient.setQueryData(
    keys.product(store().id, 'amul-taaza'),
    product({ name: 'Amul Taaza', priceCents: 2900, mrpCents: 2900 }),
  )
  renderAt('/p/amul-taaza')

  expect(await screen.findByRole('heading', { level: 1, name: 'Amul Taaza' })).toBeInTheDocument()
  expect(screen.getByText('₹29')).toBeInTheDocument()
  expect(screen.queryByText(/^Save/)).not.toBeInTheDocument()
  expect(document.querySelector('s')).toBeNull()
})

test('unknown product', async () => {
  seedStore()
  // Core answers 404 for the slug; the page caches that as null, which is not an error.
  queryClient.setQueryData(keys.product(store().id, 'no-such-thing'), null)
  renderAt('/p/no-such-thing')

  expect(await screen.findByRole('heading', { level: 1, name: 'Product not found' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/')
})
