import { fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { components } from '@shopperstop/ui/api'
import { queryClient } from './api'
import { cartKey } from './cart'
import { keys } from './catalog'
import { ProductCard } from './product-card'
import { setPincode } from './pincode'
import { setToken } from './session'
import { product, renderInRouter, store } from './test-data'

type Cart = components['schemas']['Cart']

const koramangala = '00000000-0000-4000-8000-000000000401'

afterEach(() => vi.unstubAllGlobals())

// Core answers every request with the 400 below, so the cached cart stays shown.
test("core's refusal is shown", async () => {
  vi.stubGlobal('fetch', async () =>
    new Response(JSON.stringify({ error: { code: 'validation', field: 'productId', message: 'product not available' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  setPincode('560034')
  queryClient.setQueryData(keys.serviceability('560034'), store())
  setToken('t')
  const taaza = product()
  const cart: Cart = {
    storeId: koramangala,
    items: [{ product: taaza, quantity: 1 }],
    subtotalCents: taaza.priceCents,
    deliveryFeeCents: 0,
    totalCents: taaza.priceCents,
    minOrderCents: 0,
    shortfallCents: 0,
  }
  queryClient.setQueryData(cartKey('t'), cart)
  renderInRouter(<ProductCard product={product({ name: 'Amul Taaza' })} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Add one Amul Taaza' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('product not available')
  expect(screen.getByRole('group', { name: 'Quantity of Amul Taaza' }).querySelector('span')?.textContent).toBe('1')
})
