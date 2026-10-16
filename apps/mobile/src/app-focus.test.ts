import { focusManager } from '@tanstack/react-query'
import { AppState, type AppStateStatus } from 'react-native'
import { wireAppFocus } from './app-focus'

// Returning to the app refetches stale queries only when TanStack Query knows the app is focused again.
test('background pauses focus', () => {
  const add = jest.spyOn(AppState, 'addEventListener')
  const unwire = wireAppFocus()
  const listener = add.mock.calls[0][1] as (state: AppStateStatus) => void

  listener('background')
  expect(focusManager.isFocused()).toBe(false)
  listener('active')
  expect(focusManager.isFocused()).toBe(true)

  unwire()
  add.mockRestore()
  focusManager.setFocused(undefined)
})
