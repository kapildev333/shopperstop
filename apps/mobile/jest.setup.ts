import { queryClient } from './src/api'
import { setToken } from './src/session'

// The device keychain is the process boundary, like the file system: an in-memory store stands in for it.
const mockSecureStore = new Map<string, string>()

jest.mock('expo-secure-store', () => ({
  getItem: (key: string) => mockSecureStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    mockSecureStore.set(key, value)
  },
  deleteItemAsync: async (key: string) => {
    mockSecureStore.delete(key)
  },
}))

// No request leaves the process: a test that needs the network fakes fetch itself.
const refuse = () => Promise.reject(new TypeError('Network request failed'))

beforeEach(() => {
  globalThis.fetch = refuse as typeof fetch
})

afterEach(() => {
  setToken(undefined)
  queryClient.clear()
  mockSecureStore.clear()
})
