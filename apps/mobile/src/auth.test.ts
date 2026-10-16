import * as SecureStore from 'expo-secure-store'
import { queryClient } from './api'
import { register, safeReturnTo, signIn, signOut } from './auth'
import { apiError, fakeCore, json } from './fake-core'
import { getToken, setToken } from './session'

const key = 'shopperstop.customer-token'
const customer = { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.test', name: 'Asha Rao' }

test('unsafe returnTo ignored', () => {
  expect(safeReturnTo('https://evil.example/')).toBe('/')
  expect(safeReturnTo('//evil.example/')).toBe('/')
  expect(safeReturnTo('/\\evil.example')).toBe('/')
  expect(safeReturnTo(undefined)).toBe('/')
  expect(safeReturnTo('/account')).toBe('/account')
})

test('sign in stores the token and the customer', async () => {
  fakeCore({ 'POST /auth/sign-in': () => json(200, { token: 't-6', customer }) })

  const error = await signIn({ email: customer.email, password: 'secret-pass' })

  expect(error).toBeUndefined()
  expect(getToken()).toBe('t-6')
  expect(SecureStore.getItem(key)).toBe('t-6')
  expect(queryClient.getQueryData(['me', 't-6'])).toEqual(customer)
})

test('sign in failure returns the error', async () => {
  fakeCore({ 'POST /auth/sign-in': () => apiError(401, 'unauthorized', 'Wrong email or password') })

  const error = await signIn({ email: customer.email, password: 'wrong-pass' })

  expect(error).toEqual({ code: 'unauthorized', message: 'Wrong email or password' })
  expect(getToken()).toBeUndefined()
})

test('register stores the token', async () => {
  fakeCore({ 'POST /auth/register': () => json(201, { token: 't-7', customer }) })

  const error = await register({ name: customer.name, email: customer.email, password: 'secret-pass' })

  expect(error).toBeUndefined()
  expect(getToken()).toBe('t-7')
  expect(queryClient.getQueryData(['me', 't-7'])).toEqual(customer)
})

test('sign out ends the session', async () => {
  setToken('t-8')
  queryClient.setQueryData(['me', 't-8'], customer)
  const calls = fakeCore({ 'POST /auth/sign-out': () => json(204) })

  await signOut()

  expect(calls[0].method).toBe('POST')
  expect(calls[0].headers.get('Authorization')).toBe('Bearer t-8')
  expect(getToken()).toBeUndefined()
  expect(SecureStore.getItem(key)).toBeNull()
  expect(queryClient.getQueryData(['me', 't-8'])).toBeUndefined()
})
