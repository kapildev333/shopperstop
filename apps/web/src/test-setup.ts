import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { queryClient } from './api'
import { setPincode } from './pincode'
import { setToken } from './session'

afterEach(() => {
  cleanup()
  setToken(undefined)
  setPincode(undefined)
  queryClient.clear()
})
