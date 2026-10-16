import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import {
  closePincodeSheet,
  getPincode,
  openPincodeSheet,
  setPincode,
  usePincodeSheetOpen,
} from './pincode'

const key = 'shopperstop:pincode'

afterEach(() => {
  jest.restoreAllMocks()
})

// The store is module state and its first read starts from a hook, so a read scenario needs a fresh module graph.
// The store, the storage mock and the hook renderer are loaded in one graph so that they share one React.
// The `pure` entry is used because the default entry registers an afterEach, which Jest refuses inside a test.
function loadFresh() {
  let fresh!: {
    pincode: typeof import('./pincode')
    storage: typeof AsyncStorage
    act: typeof act
    renderHook: typeof renderHook
    waitFor: typeof waitFor
  }
  jest.isolateModules(() => {
    const testing = jest.requireActual<typeof import('@testing-library/react-native/pure')>('@testing-library/react-native/pure')
    fresh = {
      pincode: jest.requireActual<typeof import('./pincode')>('./pincode'),
      // The store's own import of the storage, which the setup mocks; the mock is a plain CommonJS object with no `default` key.
      storage: jest.requireMock<typeof AsyncStorage>('@react-native-async-storage/async-storage'),
      act: testing.act,
      renderHook: testing.renderHook,
      waitFor: testing.waitFor,
    }
  })
  return fresh
}

test('pincode persisted', async () => {
  setPincode('560034')

  await expect(AsyncStorage.getItem(key)).resolves.toBe('560034')
  expect(getPincode()).toBe('560034')
})

test('pincode restored on load', async () => {
  const first = loadFresh()
  await first.storage.setItem(key, '560038')
  const firstHook = await first.renderHook(() => first.pincode.usePincode())
  await first.waitFor(() => expect(firstHook.result.current.loaded).toBe(true))
  expect(firstHook.result.current.pincode).toBe('560038')

  const second = loadFresh()
  await second.storage.setItem(key, 'abc')
  const secondHook = await second.renderHook(() => second.pincode.usePincode())
  await second.waitFor(() => expect(secondHook.result.current.loaded).toBe(true))
  expect(secondHook.result.current.pincode).toBeUndefined()
})

test('chosen pincode wins over a late read', async () => {
  const fresh = loadFresh()
  await fresh.storage.setItem(key, '560038')
  let finishRead!: (value: string | null) => void
  jest.spyOn(fresh.storage, 'getItem').mockReturnValueOnce(
    new Promise<string | null>((resolve) => {
      finishRead = resolve
    }),
  )

  const hook = await fresh.renderHook(() => fresh.pincode.usePincode())
  await fresh.act(async () => {
    fresh.pincode.setPincode('560034')
  })
  await fresh.act(async () => {
    finishRead('560038')
  })

  await fresh.waitFor(() => expect(hook.result.current.loaded).toBe(true))
  expect(hook.result.current.pincode).toBe('560034')
  expect(fresh.pincode.getPincode()).toBe('560034')
})

test('blocked storage tolerated', async () => {
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('storage blocked'))
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('storage blocked'))

  expect(() => setPincode('560034')).not.toThrow()
  await new Promise((resolve) => setImmediate(resolve))

  expect(getPincode()).toBe('560034')
})

test('sheet open state', async () => {
  const hook = await renderHook(() => usePincodeSheetOpen())
  expect(hook.result.current).toBe(false)

  await act(async () => {
    openPincodeSheet()
  })
  expect(hook.result.current).toBe(true)

  await act(async () => {
    closePincodeSheet()
  })
  expect(hook.result.current).toBe(false)
})
