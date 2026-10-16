import * as SecureStore from 'expo-secure-store'
import { getToken, setToken } from './session'

test('token persisted and cleared', () => {
  setToken('t-1')
  expect(SecureStore.getItem('shopperstop.customer-token')).toBe('t-1')

  setToken(undefined)
  expect(SecureStore.getItem('shopperstop.customer-token')).toBeNull()
  expect(getToken()).toBeUndefined()
})

test('token restored on load', () => {
  SecureStore.setItem('shopperstop.customer-token', 't-2')

  jest.isolateModules(() => {
    const session = require('./session') as typeof import('./session')
    expect(session.getToken()).toBe('t-2')
  })
})
