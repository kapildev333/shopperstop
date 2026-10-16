import { useSyncExternalStore } from 'react'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const key = 'shopperstop.customer-token'
const listeners = new Set<() => void>()

// Storage can be blocked or fail (privacy modes, a locked keychain); the token then lives in memory only.
// ponytail: expo-secure-store has no web implementation, so the web export uses localStorage under the same key.
function read(): string | undefined {
  try {
    const value = Platform.OS === 'web' ? localStorage.getItem(key) : SecureStore.getItem(key)
    return value ?? undefined
  } catch {
    return undefined
  }
}

function write(next: string | undefined) {
  try {
    if (Platform.OS === 'web') {
      if (next) localStorage.setItem(key, next)
      else localStorage.removeItem(key)
    } else if (next) {
      SecureStore.setItem(key, next)
    } else {
      // deleteItemAsync is the only delete the secure store has; a failed delete is not persisted, memory still applies.
      SecureStore.deleteItemAsync(key).catch(() => undefined)
    }
  } catch {
    // Not persisted; the in-memory token above still applies for this session.
  }
}

let token: string | undefined = read()

export function getToken() {
  return token
}

export function setToken(next: string | undefined) {
  token = next
  listeners.forEach((listener) => listener())
  write(next)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// Server snapshot is undefined: the static export renders in Node, where there is no stored token.
export function useToken() {
  return useSyncExternalStore(subscribe, getToken, () => undefined)
}
