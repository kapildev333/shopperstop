import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Link, Redirect, useRouter } from 'expo-router'
import { ChevronLeft, ChevronRight, Plus, ReceiptText } from 'lucide-react-native'
import { deleteAddress, setDefaultAddress, useAddresses, type Address } from '../addresses'
import { useBack } from '../auth-forms'
import { useMe, type ApiError } from '../api'
import { signOut } from '../auth'
import { AddressSheet } from '../address-sheet'
import { ProfileSheet } from '../profile-sheet'
import { Badge } from '../ui/badge'
import { Button, IconButton } from '../ui/button'
import { Card } from '../ui/card'
import { ErrorBanner } from '../ui/error-banner'
import { Skeleton } from '../ui/skeleton'
import { Text } from '../ui/text'
import { useToken } from '../session'
import { colors, fontFamily, radius, shadows, spacing } from '../ui/tokens'

// Signed out, the screen asks to sign in and comes back here.
export default function Account() {
  const token = useToken()
  if (!token) return <Redirect href="/sign-in?returnTo=%2Faccount" />
  return <AccountContent />
}

function AccountContent() {
  const router = useRouter()
  const back = useBack()
  // Leave the screen first: dropping the token while it is mounted would redirect to sign-in.
  function onSignOut() {
    router.replace('/')
    void signOut()
  }
  return (
    <View role="main" style={styles.screen}>
      <View style={styles.header}>
        <IconButton label="Back" icon={ChevronLeft} onPress={back} />
        <Text variant="h2" heading={1}>
          My account
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <ProfileCard />
        <Link href="/orders" asChild>
          <Pressable accessibilityRole="link" style={styles.orders}>
            <ReceiptText size={20} color={colors.ink} />
            <Text variant="body" style={styles.grow}>
              Your orders
            </Text>
            <ChevronRight size={16} color={colors.inkMuted} />
          </Pressable>
        </Link>
        <AddressesCard />
        <Button variant="danger" size="lg" onPress={onSignOut}>
          Sign out
        </Button>
      </ScrollView>
    </View>
  )
}

function ProfileCard() {
  const me = useMe()
  const [editing, setEditing] = useState(false)
  if (me.data === undefined) {
    return <Card>{me.isError ? <ErrorBanner error={me.error} onRetry={() => void me.refetch()} /> : <Skeleton count={1} />}</Card>
  }
  const customer = me.data
  return (
    <Card>
      <View style={styles.row}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.avatar}>
          <Text variant="h2" tone="onBrand">
            {customer.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.grow}>
          <Text variant="h3">{customer.name}</Text>
          <Text tone="inkMuted">{customer.email}</Text>
          {customer.phone ? (
            <Text tone="inkMuted" tabular>
              {customer.phone}
            </Text>
          ) : null}
        </View>
        <Button variant="ghost" size="compact" accessibilityLabel="Edit profile" onPress={() => setEditing(true)}>
          Edit
        </Button>
      </View>
      <ProfileSheet open={editing} customer={customer} onClose={() => setEditing(false)} />
    </Card>
  )
}

function AddressesCard() {
  const addresses = useAddresses()
  // null = sheet closed; {} = adding; { address } = editing that address.
  const [sheet, setSheet] = useState<{ address?: Address } | null>(null)
  const [actionError, setActionError] = useState<string>()

  // Row actions report their failure in one line at the top of the card.
  async function rowAction(request: () => Promise<ApiError | undefined>) {
    const error = await request()
    setActionError(error?.message)
  }

  return (
    <Card>
      <View style={styles.row}>
        <Text variant="h3" heading={2} style={styles.grow}>
          Saved addresses
        </Text>
        <Button variant="ghost" size="compact" icon={Plus} accessibilityLabel="Add address" onPress={() => setSheet({})}>
          Add
        </Button>
      </View>
      {actionError ? (
        <Text accessibilityRole="alert" tone="danger">
          {actionError}
        </Text>
      ) : null}
      {addresses.data === undefined ? (
        addresses.isError ? (
          <ErrorBanner error={addresses.error} onRetry={() => void addresses.refetch()} />
        ) : (
          <Skeleton count={2} />
        )
      ) : addresses.data.length === 0 ? (
        <Text tone="inkMuted">No saved addresses. Add one to check out faster.</Text>
      ) : (
        addresses.data.map((address) => (
          <View key={address.id} style={[styles.address, address.isDefault ? styles.addressDefault : null]}>
            <View style={styles.row}>
              <Text variant="body" style={styles.label}>
                {address.label}
              </Text>
              {address.isDefault ? <Badge variant="accent">Default</Badge> : null}
            </View>
            <Text tone="inkMuted">{[address.line1, address.line2, address.pincode].filter(Boolean).join(', ')}</Text>
            <View style={styles.actions}>
              <Button
                variant="ghost"
                size="compact"
                accessibilityLabel={`Edit ${address.label}`}
                onPress={() => setSheet({ address })}
              >
                Edit
              </Button>
              {address.isDefault ? null : (
                <Button
                  variant="ghost"
                  size="compact"
                  accessibilityLabel={`Set ${address.label} as default`}
                  onPress={() => void rowAction(() => setDefaultAddress(address.id))}
                >
                  Set as default
                </Button>
              )}
              <Button
                variant="ghostDanger"
                size="compact"
                accessibilityLabel={`Delete ${address.label}`}
                onPress={() => void rowAction(() => deleteAddress(address.id))}
              >
                Delete
              </Button>
            </View>
          </View>
        ))
      )}
      <AddressSheet open={sheet !== null} address={sheet?.address} onClose={() => setSheet(null)} />
    </Card>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit,
    height: 64,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  content: { padding: 12, paddingBottom: 32, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orders: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    boxShadow: shadows.card.boxShadow,
  },
  label: { fontFamily: fontFamily(600) },
  address: {
    gap: spacing.unit + 2,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    marginTop: 12,
  },
  addressDefault: { borderColor: colors.accent },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
})
