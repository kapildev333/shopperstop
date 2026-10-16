import AsyncStorage from '@react-native-async-storage/async-storage'
import { configure } from '@testing-library/react-native'
import { queryClient } from './src/api'
import { clearCart } from './src/cart'
import { closePincodeSheet, setPincode } from './src/pincode'
import { setToken } from './src/session'

// findBy waits 1000 ms by default; a cold expo-router render under parallel load can exceed that, so waits get 5 s.
configure({ asyncUtilTimeout: 5000 })

// Query's gc timers (5 minutes each) would outlive the test and keep Jest from exiting; no test needs cache eviction.
queryClient.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } })

// The device's async storage is the process boundary: the library's own in-memory mock stands in for it.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

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

afterEach(async () => {
  setToken(undefined)
  setPincode(undefined)
  closePincodeSheet()
  await clearCart()
  queryClient.clear()
  mockSecureStore.clear()
  await AsyncStorage.clear()
})
