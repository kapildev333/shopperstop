import { useSyncExternalStore } from 'react'
import { createTokenStore } from '@shopperstop/ui/app'

const store = createTokenStore('shopperstop:customer-token')

export const getToken = store.get
export const setToken = store.set

// ponytail: no `storage` listener, so a sign-out in one tab leaves other tabs holding the token until their next 401. Add the listener when a customer reports it.
export function useToken() {
  return useSyncExternalStore(store.subscribe, store.get)
}
