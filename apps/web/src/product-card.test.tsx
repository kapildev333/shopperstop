import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { ProductCard } from './product-card'
import { product, renderInRouter } from './test-data'

test('card links and prices', async () => {
  renderInRouter(
    <ProductCard product={product({ name: 'Amul Taaza', slug: 'amul-taaza', unitLabel: '500 ml', priceCents: 2700, mrpCents: 2900 })} />,
  )
  expect(await screen.findByRole('link', { name: 'Amul Taaza 500 ml' })).toHaveAttribute('href', '/p/amul-taaza')
  expect(screen.getByText('₹27')).toBeInTheDocument()
  expect(screen.getByText('₹29').tagName).toBe('S')
  expect(document.querySelector('[data-placeholder]')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Add Amul Taaza' })).toBeEnabled()
})

test('add shows the count', async () => {
  renderInRouter(<ProductCard product={product({ name: 'Amul Taaza' })} />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Add Amul Taaza' }))
  const group = screen.getByRole('group', { name: 'Quantity of Amul Taaza' })
  expect(within(group).getByText('1')).toBeInTheDocument()
})

test('out of stock card', async () => {
  renderInRouter(<ProductCard product={product({ name: 'Amul Taaza', inStock: false, quantity: 0 })} />)
  expect(await screen.findByRole('button', { name: 'Out of stock' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Add Amul Taaza' })).not.toBeInTheDocument()
})
