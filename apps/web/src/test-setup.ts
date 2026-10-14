import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { queryClient } from './api'
import { closeCart } from './cart-drawer'
import { setPincode } from './pincode'
import { cancelStoreChange } from './store-change'
import { clearGuestCart } from './guest-cart'
import { setToken } from './session'

afterEach(() => {
  cleanup()
  setToken(undefined)
  setPincode(undefined)
  closeCart()
  cancelStoreChange()
  clearGuestCart()
  queryClient.clear()
})
