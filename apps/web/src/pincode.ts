import { useSyncExternalStore } from 'react'

const key = 'shopperstop:pincode'
export const pincodePattern = /^[1-9][0-9]{5}$/
type PincodeState = { pincode?: string; sheetOpen: boolean }
const listeners = new Set<() => void>()

// Storage can be blocked or full; the pincode then lives in memory for this page.
function read() {
  try {
    const value = localStorage.getItem(key) ?? undefined
    return value && pincodePattern.test(value) ? value : undefined
  } catch {
    return undefined
  }
}

// Every change replaces the object, so the snapshot is stable between changes.
let state: PincodeState = { pincode: read(), sheetOpen: false }

function publish(next: PincodeState) {
  state = next
  listeners.forEach((listener) => listener())
}

export function getPincode() {
  return state.pincode
}

export function setPincode(next: string | undefined) {
  publish({ pincode: next, sheetOpen: false })
  try {
    if (next) localStorage.setItem(key, next)
    else localStorage.removeItem(key)
  } catch {
    // Not persisted; the in-memory pincode above still applies for this page.
  }
}

export function openPincodeSheet() {
  publish({ ...state, sheetOpen: true })
}

export function closePincodeSheet() {
  publish({ ...state, sheetOpen: false })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePincode() {
  return useSyncExternalStore(subscribe, () => state)
}
