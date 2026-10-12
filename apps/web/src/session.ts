import { useSyncExternalStore } from 'react'

const key = 'shopperstop:customer-token'
const listeners = new Set<() => void>()

// Storage can be blocked or full (privacy modes, disabled cookies); the token then lives in memory only.
function read() {
  try {
    return localStorage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

let token: string | undefined = read()

export function getToken() {
  return token
}

export function setToken(next: string | undefined) {
  token = next
  listeners.forEach((listener) => listener())
  try {
    if (next) localStorage.setItem(key, next)
    else localStorage.removeItem(key)
  } catch {
    // Not persisted; the in-memory token above still applies for this page.
  }
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
