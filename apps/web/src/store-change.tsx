import { useState, useSyncExternalStore } from 'react'
import { Button, Dialog, DialogFooter, ErrorBanner } from '@shopperstop/ui'
import { queryClient } from './api'
import { cartOptions, clearCart } from './cart'
import { serviceabilityOptions, type Store } from './catalog'
import { getGuestCart, type CartView } from './guest-cart'
import { closePincodeSheet, setPincode } from './pincode'
import { getToken } from './session'

type Pending = { pincode: string; store: Store }

// The pending change is a module store, like the pincode: the sheet that asks for it and the dialog that confirms it sit apart.
let pending: Pending | undefined
const listeners = new Set<() => void>()

function publish(next: Pending | undefined) {
  pending = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function usePending() {
  return useSyncExternalStore(subscribe, () => pending)
}

// The cart as far as it is known: the server's (cached or fetched), else the guest's. A failed read counts as unknown.
async function knownCart(token: string | undefined): Promise<Pick<CartView, 'storeId' | 'items'> | undefined> {
  if (!token) return getGuestCart()
  return queryClient.fetchQuery(cartOptions(token)).catch(() => undefined)
}

// The store is compared, not the pincode: two pincodes can be one store (560034 and 560095 are both Koramangala).
export async function changePincode(next: string): Promise<void> {
  const token = getToken()
  // A guest with an empty cart stores the pincode before anything is awaited.
  if (!token && getGuestCart().items.length === 0) {
    setPincode(next)
    return
  }
  const cart = await knownCart(token)
  if (!cart?.storeId || cart.items.length === 0) {
    setPincode(next)
    return
  }
  const store = await queryClient.fetchQuery(serviceabilityOptions(next)).catch(() => undefined)
  if (!store || store.id === cart.storeId) {
    setPincode(next)
    return
  }
  closePincodeSheet()
  publish({ pincode: next, store })
}

export function cancelStoreChange() {
  publish(undefined)
}

export function StoreChangeDialog() {
  const change = usePending()
  return (
    <Dialog open={!!change} onClose={cancelStoreChange} title="Change store?">
      {change && <StoreChangeBody change={change} />}
    </Dialog>
  )
}

// Mounted only while the dialog is open, so each opening starts with no error and no busy state.
function StoreChangeBody({ change }: { change: Pending }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function confirm() {
    setBusy(true)
    setFailed(false)
    const error = await clearCart()
    // Cancel was chosen while the DELETE was in flight: the pincode stays where it was.
    if (pending !== change) return
    if (error) {
      setBusy(false)
      setFailed(true)
      return
    }
    setPincode(change.pincode)
    publish(undefined)
  }

  return (
    <>
      <p className="mt-2 text-body text-ink">
        {change.store.name} delivers to {change.pincode}. Your cart holds products from another store and will be emptied.
      </p>
      {failed && <ErrorBanner className="mt-4" message="Could not empty your cart." />}
      <DialogFooter onCancel={cancelStoreChange}>
        <Button loading={busy} onClick={() => void confirm()}>
          Empty cart and change
        </Button>
      </DialogFooter>
    </>
  )
}
