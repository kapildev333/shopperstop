import { act, renderHook } from '@testing-library/react-native'
import { clearCart, getCartSummary, setQuantity, useCartSummary, useQuantity } from './cart'

test('counts belong to one store', async () => {
  const hook = await renderHook(() => ({
    a: useQuantity('product-a'),
    b: useQuantity('product-b'),
    summary: useCartSummary(),
  }))

  await act(() => {
    setQuantity('store-1', 'product-a', 2)
  })
  await act(() => {
    setQuantity('store-2', 'product-b', 1)
  })

  expect(hook.result.current.a).toBe(0)
  expect(hook.result.current.b).toBe(1)
  expect(hook.result.current.summary).toEqual({ count: 1, storeId: 'store-2' })
  // The setup resets the cart after this test, before the renderer's own cleanup unmounts the hook.
  hook.unmount()
})

test('clear empties the counts', async () => {
  setQuantity('store-1', 'product-a', 2)

  await expect(clearCart()).resolves.toBeUndefined()

  expect(getCartSummary().count).toBe(0)
  expect(getCartSummary().storeId).toBeUndefined()
})
