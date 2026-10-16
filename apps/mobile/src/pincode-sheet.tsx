import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Link } from 'expo-router'
import { ShoppingBag } from 'lucide-react-native'
import { useAddresses } from './addresses'
import { clearCart, getCartSummary } from './cart'
import { queryClient } from './api'
import { closePincodeSheet, getPincode, isPincode, setPincode, usePincodeSheetOpen } from './pincode'
import { resolvePincode, type Store } from './serviceability'
import { useToken } from './session'
import { Button } from './ui/button'
import { Chip } from './ui/chip'
import { Dialog, DialogFooter } from './ui/dialog'
import { FormField } from './ui/form-field'
import { Sheet } from './ui/sheet'
import { Text } from './ui/text'
import { colors, fontFamily, radius, spacing } from './ui/tokens'

// A cart switch the customer has to confirm: the new pincode's store, the old store's name, and the counts it would empty.
type Change = { pincode: string; store: Store; from: string; count: number }

// The one pincode sheet the root layout mounts; any screen's control opens it through the pincode store.
export function PincodeSheet() {
  const open = usePincodeSheetOpen()
  const [change, setChange] = useState<Change>()
  return (
    <>
      <Sheet open={open} title="Where should we deliver?" onClose={closePincodeSheet}>
        {open ? <PincodeForm onOtherStore={setChange} /> : null}
      </Sheet>
      <StoreChangeDialog change={change} onClose={() => setChange(undefined)} />
    </>
  )
}

// Mounted only while open, so each open starts from the stored pincode.
function PincodeForm({ onOtherStore }: { onOtherStore: (change: Change) => void }) {
  const token = useToken()
  const addresses = useAddresses()
  const [value, setValue] = useState(getPincode() ?? '')
  const [pending, setPending] = useState(false)
  // False once the sheet closes: a lookup that finishes after a dismissal saves nothing.
  const open = useRef(true)
  useEffect(() => {
    open.current = true
    return () => {
      open.current = false
    }
  }, [])

  async function next() {
    setPending(true)
    // A failed lookup stores the pincode anyway: the header then shows the lookup's error with "Try again".
    const store = await resolvePincode(value).then(
      (answer) => answer.store,
      () => undefined,
    )
    setPending(false)
    if (!open.current) return
    const cart = getCartSummary()
    if (store && cart.count > 0 && cart.storeId && store.id !== cart.storeId) {
      const from = queryClient.getQueryData<{ store?: Store }>(['serviceability', getPincode()])?.store?.name ?? 'another store'
      closePincodeSheet()
      return onOtherStore({ pincode: value, store, from, count: cart.count })
    }
    setPincode(value)
    closePincodeSheet()
  }

  const invalid = value.length === 6 && !isPincode(value)
  return (
    <View style={styles.body}>
      <Text tone="inkMuted">Enter your pincode to see the store near you and what it has in stock.</Text>
      <FormField
        label="Pincode"
        placeholder="6-digit pincode"
        keyboardType="number-pad"
        maxLength={6}
        tabular
        autoFocus
        returnKeyType="go"
        value={value}
        // Digits only, six at most: a pasted "560 034" or "56a00349" keeps what it can.
        onChangeText={(text) => setValue(text.replace(/\D/g, '').slice(0, 6))}
        onSubmitEditing={() => !pending && isPincode(value) && next()}
        hint="We currently deliver in parts of Bengaluru."
        error={invalid ? 'That is not a valid pincode.' : undefined}
      />
      {token && addresses.data && addresses.data.length > 0 ? (
        <View style={styles.chips}>
          {addresses.data.map((address) => (
            <Chip key={address.id} selected={value === address.pincode} onPress={() => setValue(address.pincode)}>
              {`${address.label} · ${address.pincode}`}
            </Chip>
          ))}
        </View>
      ) : null}
      <Button size="lg" disabled={!isPincode(value)} loading={pending} onPress={next}>
        Continue
      </Button>
      {token ? null : (
        <Link href={{ pathname: '/sign-in', params: { returnTo: '/' } }} asChild>
          <Pressable accessibilityRole="link" onPress={closePincodeSheet} style={styles.link}>
            <Text tone="accent" style={styles.linkLabel}>
              Have an account? Sign in to use a saved address
            </Text>
          </Pressable>
        </Link>
      )}
    </View>
  )
}

// Keep cart, the Android back gesture and Escape keep the pincode and the cart; a second press while clearing is ignored.
function StoreChangeDialog({ change, onClose }: { change?: Change; onClose: () => void }) {
  const [clearing, setClearing] = useState(false)
  const [failed, setFailed] = useState(false)
  const busy = useRef(false)

  function keep() {
    if (!busy.current) onClose()
  }

  async function switchStore() {
    if (!change || busy.current) return
    busy.current = true
    setClearing(true)
    const error = await clearCart()
    busy.current = false
    setClearing(false)
    // The dialog stays open with the alert; the pincode does not change.
    if (error) return setFailed(true)
    setFailed(false)
    setPincode(change.pincode)
    onClose()
  }

  const items = change?.count === 1 ? '1 item' : `${change?.count} items`
  return (
    <Dialog open={!!change} title={`Switch to the ${change?.store.name ?? ''} store?`} onClose={keep}>
      <View style={styles.icon} aria-hidden>
        <ShoppingBag size={24} color={colors.ink} />
      </View>
      <Text tone="inkMuted">
        {`Pincode ${change?.pincode} is served by a different store. Your cart has ${items} from ${change?.from}; switching will empty it.`}
      </Text>
      {failed ? (
        <View accessibilityRole="alert" style={styles.alert}>
          <Text tone="danger">Could not empty your cart.</Text>
        </View>
      ) : null}
      <DialogFooter>
        <Button variant="secondary" size="lg" onPress={keep}>
          Keep cart
        </Button>
        <Button size="lg" loading={clearing} onPress={switchStore}>
          Switch store
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

const styles = StyleSheet.create({
  body: {
    gap: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.unit * 2,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkLabel: {
    fontFamily: fontFamily(600),
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alert: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.control,
    padding: 12,
  },
})
