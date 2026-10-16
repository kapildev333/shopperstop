import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Redirect, useRouter } from 'expo-router'
import Head from 'expo-router/head'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Banknote, Check, ChevronLeft, ChevronRight } from 'lucide-react-native'
import { formatInr } from '@shopperstop/ui/format'
import { useAddresses } from './addresses'
import { AddressCard, chosenAddress } from './checkout-address'
import { blockReason, outcomeOf, placeOrder, type Refusal } from './checkout'
import { imageUri } from './catalog'
import { cartKey, openCartSheet, storeOptions, useCart, type CartView } from './cart'
import type { CartLine } from './cart-guest'
import { queryClient } from './api'
import { useBack } from './screen-support'
import { useToken } from './session'
import { Button, IconButton } from './ui/button'
import { EmptyState } from './ui/empty-state'
import { ErrorBanner } from './ui/error-banner'
import { ImageTile } from './ui/image-tile'
import { Skeleton } from './ui/skeleton'
import { Text } from './ui/text'
import { colors, fontFamily, radius, shadows, spacing } from './ui/tokens'

// Signed out, the screen asks to sign in and comes back to checkout.
export function CheckoutScreen() {
  const token = useToken()
  if (!token) return <Redirect href="/sign-in?returnTo=%2Fcheckout" />
  return <Checkout />
}

function Checkout() {
  const { view, isError, error, refetch } = useCart()
  const addresses = useAddresses()
  const router = useRouter()
  const back = useBack()
  // The address chosen on this screen; none until the customer chooses one, so the card shows the default.
  const [chosen, setChosen] = useState<string>()
  const selected = chosenAddress(addresses.data, chosen)
  const token = useToken() ?? ''
  // A ref, not the state: a second press in the same tick must not send a second order.
  const sending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<Refusal>()
  // The address core refused, with the address list as it was read then: the badge goes once the list is read again.
  const [refused, setRefused] = useState<{ addressId: string; listedAt: number }>()
  // The lines are the cart's store: the pincode's store is never read here.
  const store = useQuery({ ...storeOptions(view?.storeId ?? ''), enabled: !!view?.storeId })

  // The answer decides the screen: an order or an emptied cart replaces it; anything else stays here with its refusal.
  async function place() {
    // Nothing to send to until the address list has answered with a chosen address.
    if (sending.current || !selected) return
    sending.current = true
    setBusy(true)
    setRefusal(undefined)
    setRefused(undefined)
    const result = await placeOrder(selected.id)
    const outcome = outcomeOf(result, queryClient.getQueryData<CartView>(cartKey(token)), store.data?.name ?? 'The store', selected.id)
    if ('to' in outcome) {
      // Replaced, not pushed: Back from the order does not return to an empty checkout. The sending ref stays set.
      router.replace(outcome.to)
      return
    }
    sending.current = false
    setBusy(false)
    setRefusal(outcome.refusal)
    if (outcome.refusal.addressId) setRefused({ addressId: outcome.refusal.addressId, listedAt: addresses.dataUpdatedAt })
  }

  // Choosing another address clears an address refusal's alert; the refused address keeps its badge.
  const choose = (id: string) => {
    setChosen(id)
    setRefusal((current) => (current?.addressId ? undefined : current))
  }
  const refusedId = refused && refused.listedAt === addresses.dataUpdatedAt ? refused.addressId : undefined

  let body
  if (!view) {
    body = (
      <View style={styles.pad}>
        {isError ? <ErrorBanner error={error} onRetry={() => void refetch()} /> : <Skeleton count={3} />}
      </View>
    )
  } else if (view.items.length === 0) {
    body = (
      <View style={styles.pad}>
        <EmptyState
          title="Your cart is empty"
          description="Add something from the store to place an order."
          action={
            <View style={styles.actions}>
              <Button size="lg" onPress={() => router.navigate('/')}>
                Start shopping
              </Button>
              <Button variant="secondary" size="lg" onPress={() => router.navigate('/orders')}>
                Your orders
              </Button>
            </View>
          }
        />
      </View>
    )
  } else {
    const reason = blockReason({
      marked: false,
      subtotalCents: view.subtotalCents,
      minOrderCents: view.minOrderCents,
      // Until the list is read, no address is known to be missing: the block waits for the answer.
      hasAddress: addresses.data === undefined || selected !== undefined,
    })
    body = (
      <>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
          {refusal ? <Alert refusal={refusal} onOrders={() => router.navigate('/orders')} /> : null}
          <AddressCard chosen={chosen} onChoose={choose} refusedId={refusedId} />
          <View style={styles.card}>
            {store.data ? (
              <View style={styles.gap}>
                <Text variant="h3" heading={2}>
                  {`Delivery in ${store.data.promisedMinutes} minutes`}
                </Text>
                <Text variant="small" tone="inkMuted">
                  {`From ${store.data.name}`}
                </Text>
              </View>
            ) : null}
            {view.items.map((line) => (
              <Line key={line.product.id} line={line} />
            ))}
          </View>
          <View style={[styles.card, styles.gapTight]}>
            <Text variant="h3" heading={2}>
              Payment
            </Text>
            <View style={styles.option}>
              <View aria-hidden>
                <Banknote size={20} color={colors.ink} />
              </View>
              <View style={styles.flex}>
                <Text style={{ fontFamily: fontFamily(600) }}>Cash on delivery</Text>
                <Text variant="small">Pay the rider in cash</Text>
              </View>
              <View aria-hidden>
                <Check size={20} color={colors.accent} />
              </View>
            </View>
            <Text variant="small" tone="inkMuted">
              UPI and cards come with the payment service.
            </Text>
          </View>
          <View style={[styles.card, styles.gapTight]}>
            <Row label="Items total" value={formatInr(view.subtotalCents)} />
            <Row label="Delivery fee" value={view.deliveryFeeCents === 0 ? 'FREE' : formatInr(view.deliveryFeeCents)} />
            <View style={styles.total}>
              <Text variant="h3" style={{ fontFamily: fontFamily(700) }}>
                To pay
              </Text>
              <Text variant="h3" tabular style={{ fontFamily: fontFamily(700) }}>
                {formatInr(view.totalCents)}
              </Text>
            </View>
          </View>
        </ScrollView>
        <Bar total={view.totalCents} reason={reason} busy={busy} onPlace={() => void place()} />
      </>
    )
  }

  return (
    <View role="main" style={styles.root}>
      <Head>
        <title>Checkout · ShopperStop</title>
      </Head>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={styles.header}>
          <IconButton
            label="Back to cart"
            icon={ChevronLeft}
            onPress={() => {
              back()
              openCartSheet()
            }}
          />
          <Text variant="h2" heading={1}>
            Checkout
          </Text>
        </View>
      </SafeAreaView>
      {body}
    </View>
  )
}

function Line({ line }: { line: CartLine }) {
  const { product, quantity } = line
  return (
    <View style={styles.line}>
      <ImageTile uri={imageUri(product.imageUrl)} size={48} />
      <View style={styles.flex}>
        <Text numberOfLines={2}>{product.name}</Text>
        <Text variant="small" tone="inkMuted">{`${quantity} × ${product.unitLabel}`}</Text>
      </View>
      <Text tabular style={{ fontFamily: fontFamily(600) }}>
        {formatInr(product.priceCents * quantity)}
      </Text>
    </View>
  )
}

// The refusal, with its second line and, for an unconfirmed placement, the way to check the orders.
function Alert({ refusal, onOrders }: { refusal: Refusal; onOrders: () => void }) {
  return (
    <View accessibilityRole="alert" style={styles.alert}>
      <Text style={{ fontFamily: fontFamily(600) }}>{refusal.message}</Text>
      {refusal.detail ? <Text>{refusal.detail}</Text> : null}
      {refusal.unconfirmed ? (
        <Button variant="secondary" onPress={onOrders}>
          Your orders
        </Button>
      ) : null}
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text>{label}</Text>
      <Text tabular>{value}</Text>
    </View>
  )
}

// The one bar: the amount to pay, or the block that says why the order cannot be placed.
function Bar({ total, reason, busy, onPlace }: { total: number; reason?: string; busy: boolean; onPlace: () => void }) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.bar}>
      {reason ? (
        <View style={styles.block}>
          <Text style={[styles.blockText, { fontFamily: fontFamily(600) }]}>{reason}</Text>
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Place order" accessibilityState={{ busy }} onPress={onPlace} style={styles.place}>
          <Text variant="button" tone="onAccent" tabular style={{ fontFamily: fontFamily(700) }}>
            {formatInr(total)}
          </Text>
          <View style={styles.placeRight}>
            <Text variant="button" tone="onAccent">
              Place order
            </Text>
            <View aria-hidden>
              <ChevronRight size={16} color={colors.onAccent} />
            </View>
          </View>
        </Pressable>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit,
    paddingHorizontal: spacing.unit * 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pad: { padding: spacing.unit * 3, gap: spacing.unit * 3 },
  alert: {
    borderRadius: radius.card,
    backgroundColor: colors.dangerSoft,
    padding: spacing.unit * 3,
    gap: spacing.unit * 2,
  },
  actions: { alignSelf: 'stretch', gap: spacing.unit * 2 },
  scroll: { padding: spacing.unit * 3, gap: spacing.unit * 3 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.unit * 3,
    gap: spacing.unit * 3,
    boxShadow: shadows.card.boxShadow,
  },
  gap: { gap: spacing.unit / 2 },
  gapTight: { gap: spacing.unit * 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.unit * 3 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 3,
    padding: spacing.unit * 3,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.unit * 2 },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.unit * 2,
  },
  bar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.unit * 4,
    paddingVertical: spacing.unit * 3,
    boxShadow: shadows.sheet.boxShadow,
  },
  block: {
    minHeight: 52,
    borderRadius: radius.card,
    backgroundColor: colors.canvas,
    padding: spacing.unit * 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockText: { textAlign: 'center', color: colors.ink },
  place: {
    minHeight: 52,
    borderRadius: radius.card,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.unit * 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.unit },
})
