import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useSyncExternalStore } from 'react'

export const pincodeKey = 'shopperstop:pincode'

type PincodeState = { pincode?: string; loaded: boolean }

const listeners = new Set<() => void>()
// Replaced, never mutated: useSyncExternalStore compares snapshots by identity.
let state: PincodeState = { loaded: false }
let sheetOpen = false
let readStarted = false

export function isPincode(value: string): boolean {
  return /^[1-9][0-9]{5}$/.test(value)
}

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getPincode() {
  return state.pincode
}

// Storage can be blocked or fail; the pincode then lives in memory only. The async function never rejects outward.
async function persist(next: string | undefined) {
  try {
    if (next) await AsyncStorage.setItem(pincodeKey, next)
    else await AsyncStorage.removeItem(pincodeKey)
  } catch {
    // Not persisted; the in-memory pincode above still applies for this session.
  }
}

export function setPincode(next: string | undefined): void {
  // A choice made before the first read settles wins: that read is dropped in startRead.
  state = { pincode: next, loaded: true }
  emit()
  void persist(next)
}

// One read per app run. Until it settles the pincode is not yet known.
function startRead() {
  if (readStarted) return
  readStarted = true
  void (async () => {
    let stored: string | null = null
    try {
      stored = await AsyncStorage.getItem(pincodeKey)
    } catch {
      stored = null
    }
    if (state.loaded) return
    state = { pincode: stored && isPincode(stored) ? stored : undefined, loaded: true }
    emit()
  })()
}

// Server snapshot is not yet known: the static export renders in Node, where storage is not read.
const notYetKnown: PincodeState = { loaded: false }

export function usePincode(): PincodeState {
  const current = useSyncExternalStore(subscribe, () => state, () => notYetKnown)
  useEffect(startRead, [])
  return current
}

export function openPincodeSheet(): void {
  sheetOpen = true
  emit()
}

export function closePincodeSheet(): void {
  sheetOpen = false
  emit()
}

export function usePincodeSheetOpen(): boolean {
  return useSyncExternalStore(subscribe, () => sheetOpen, () => false)
}
