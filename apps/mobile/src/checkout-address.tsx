import { useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { MapPin } from 'lucide-react-native'
import { useAddresses, type Address } from './addresses'
import { AddressSheet } from './address-sheet'
import { queryClient } from './api'
import { ErrorBanner } from './ui/error-banner'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Sheet } from './ui/sheet'
import { Skeleton } from './ui/skeleton'
import { Text } from './ui/text'
import { colors, fontFamily, radius, shadows, spacing } from './ui/tokens'
import { useToken } from './session'

// The address the checkout ships to: the one chosen here, else the default, else the first listed.
export function chosenAddress(list: Address[] | undefined, chosen: string | undefined): Address | undefined {
  if (!list) return undefined
  return list.find((address) => address.id === chosen) ?? list.find((address) => address.isDefault) ?? list[0]
}

export function addressLine(address: Address): string {
  return [address.line1, address.line2, address.pincode].filter(Boolean).join(', ')
}

type Props = { chosen?: string; onChoose: (id: string) => void; refusedId?: string }

// The card reads the address list itself and owns the "Choose address" and "Add address" sheets.
export function AddressCard({ chosen, onChoose, refusedId }: Props) {
  const addresses = useAddresses()
  const token = useToken()
  const [choosing, setChoosing] = useState(false)
  const [adding, setAdding] = useState(false)
  // The ids listed when the address sheet opened; the one listed afterwards is the one just saved.
  const listedBefore = useRef<string[]>([])
  const list = addresses.data
  const selected = chosenAddress(list, chosen)

  function openAdd() {
    listedBefore.current = (list ?? []).map((address) => address.id)
    setChoosing(false)
    setAdding(true)
  }

  // Read from the cache: the save awaited the list's refetch, and this callback may hold a render older than that.
  function closeAdd() {
    setAdding(false)
    const listed = queryClient.getQueryData<Address[]>(['addresses', token]) ?? []
    const fresh = listed.find((address) => !listedBefore.current.includes(address.id))
    if (fresh) onChoose(fresh.id)
  }

  return (
    <>
      <View style={styles.card}>
        {list === undefined ? (
          addresses.isError ? (
            <View style={styles.flex}>
              <ErrorBanner error={addresses.error} onRetry={() => void addresses.refetch()} />
            </View>
          ) : (
            <View style={styles.flex}>
              <Skeleton count={1} />
            </View>
          )
        ) : selected === undefined ? (
          <View style={styles.empty}>
            <Text variant="h3" heading={2}>
              No addresses yet
            </Text>
            <Text tone="inkMuted">Add one to place the order.</Text>
            <Button variant="secondary" onPress={openAdd}>
              Add address
            </Button>
          </View>
        ) : (
          <>
            <View style={styles.pin} aria-hidden>
              <MapPin size={20} color={colors.ink} />
            </View>
            <View style={styles.flex}>
              <View style={styles.titleRow}>
                <Text variant="h3" heading={2}>
                  {`Delivering to ${selected.label}`}
                </Text>
                {selected.id === refusedId ? <Badge variant="warning">Not delivered here</Badge> : null}
              </View>
              <Text tone="inkMuted">{addressLine(selected)}</Text>
              <Button variant="ghost" size="compact" accessibilityLabel="Change address" onPress={() => setChoosing(true)}>
                Change
              </Button>
            </View>
          </>
        )}
      </View>
      <Sheet open={choosing} title="Choose address" onClose={() => setChoosing(false)}>
        <View accessibilityRole="radiogroup" accessibilityLabel="Deliver to" style={styles.group}>
          {(list ?? []).map((address) => {
            const checked = address.id === selected?.id
            return (
              <Pressable
                key={address.id}
                accessibilityRole="radio"
                accessibilityState={{ checked }}
                accessibilityLabel={`Deliver to ${address.label}`}
                onPress={() => {
                  onChoose(address.id)
                  setChoosing(false)
                }}
                style={[styles.option, checked ? styles.optionChecked : null]}
              >
                <View aria-hidden style={[styles.dot, checked ? styles.dotChecked : null]}>
                  {checked ? <View style={styles.dotInner} /> : null}
                </View>
                <View style={styles.flex}>
                  <View style={styles.titleRow}>
                    <Text style={{ fontFamily: fontFamily(600) }}>{address.label}</Text>
                    {address.isDefault ? <Badge variant="accent">Default</Badge> : null}
                    {address.id === refusedId ? <Badge variant="warning">Not delivered here</Badge> : null}
                  </View>
                  <Text variant="small" tone="inkMuted">
                    {addressLine(address)}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>
        <Button variant="secondary" size="lg" onPress={openAdd}>
          Add address
        </Button>
      </Sheet>
      <AddressSheet open={adding} onClose={closeAdd} />
    </>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.unit * 3,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.unit * 3,
    boxShadow: shadows.card.boxShadow,
  },
  flex: {
    flex: 1,
    gap: spacing.unit / 2,
  },
  pin: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    gap: spacing.unit * 2,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.unit * 2,
  },
  group: {
    gap: spacing.unit * 3,
  },
  option: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.unit * 3,
    padding: spacing.unit * 3,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
  },
  optionChecked: {
    borderColor: colors.accent,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotChecked: {
    borderColor: colors.accent,
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
})
