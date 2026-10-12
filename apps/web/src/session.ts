import { useSyncExternalStore } from 'react'

const key = 'shopperstop:customer-token'
let token: string | undefined = localStorage.getItem(key) ?? undefined
const listeners = new Set<() => void>()

export function getToken() {
  return token
}

export function setToken(next: string | undefined) {
  token = next
  if (next) localStorage.setItem(key, next)
  else localStorage.removeItem(key)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// ponytail: no `storage` listener, so a sign-out in one tab leaves other tabs holding the token until their next 401. Add the listener when a customer reports it.
export function useToken() {
  return useSyncExternalStore(subscribe, getToken)
}
