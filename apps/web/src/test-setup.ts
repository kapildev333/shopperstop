import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { queryClient } from './api'
import { setToken } from './session'

afterEach(() => {
  cleanup()
  setToken(undefined)
  queryClient.clear()
})
