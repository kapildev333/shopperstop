import { useEffect } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Link } from 'expo-router'
import { formatInr } from '@shopperstop/ui/format'
import { ChevronRight, ShoppingBag, Timer } from 'lucide-react-native'
import { imageUri } from './catalog'
import { CartWriteAlert } from './cart-alert'
import { useCart, useLineQuantity, useLineWrite, useStoreName, openCartSheet, closeCartSheet, useCartSheetOpen } from './cart'
import { itemCount, maxQuantity, mrpTotalCents, type CartLine, type CartView } from './cart-guest'
import { useStore, type Store } from './serviceability'
import { useToken } from './session'
import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'
import { ErrorBanner } from './ui/error-banner'
import { ImageTile } from './ui/image-tile'
import { Price } from './ui/price'
import { Sheet } from './ui/sheet'
import { Skeleton } from './ui/skeleton'
import { StatusMessage } from './ui/status-message'
import { Stepper } from './ui/stepper'
import { Text } from './ui/text'
import { colors, fontFamily, radius } from './ui/tokens'

// The one cart sheet the root layout mounts; the cart bar and a replaced answer open it through the cart store.
export function CartSheet() {
  const open = useCartSheetOpen()
  const { view, isError, error, refetch } = useCart()
  const store = useStore()
  const replacedFrom = useStoreName(view?.replacedStoreId) ?? 'another store'
  // A replaced answer opens the sheet once per answer: closing it keeps it closed until the next answer.
  const answer = view?.replaced ? view : undefined
  useEffect(() => {
    if (answer) openCartSheet()
  }, [answer])
  const footer = open && view && view.items.length > 0 ? <CartFooter view={view} /> : undefined
  return (
    <Sheet open={open} title="My cart" onClose={closeCartSheet} footer={footer}>
      {open ? (
        <CartBody
          view={view}
          isError={isError}
          error={error}
          onRetry={refetch}
          store={store.kind === 'open' ? store.store : undefined}
          replacedFrom={replacedFrom}
        />
      ) : null}
    </Sheet>
  )
}

type BodyProps = {
  view?: CartView
  isError: boolean
  error: unknown
  onRetry: () => void
  store?: Store
  replacedFrom: string
}

function CartBody({ view, isError, error, onRetry, store, replacedFrom }: BodyProps) {
  // Nothing held yet: the read is loading, or it failed and the customer can read again.
  if (!view) return isError ? <ErrorBanner error={error} onRetry={onRetry} /> : <Skeleton count={3} />
  return (
    <View style={styles.body}>
      {view.replaced ? (
        <StatusMessage tone="warning">
          {`Your cart from ${replacedFrom} was replaced. A cart holds products from one store.`}
        </StatusMessage>
      ) : null}
      {view.clamped ? <StatusMessage>Some quantities were lowered to what the store has.</StatusMessage> : null}
      {view.items.length === 0 ? <EmptyCart /> : <Lines view={view} store={store} />}
    </View>
  )
}

function EmptyCart() {
  return (
    <View style={styles.empty}>
      <EmptyState
        icon={
          <View style={styles.emptyIcon} aria-hidden>
            <ShoppingBag size={44} color={colors.ink} />
          </View>
        }
        title="Your cart is empty"
        description="Milk, bread, snacks and more, delivered from the store near you in minutes."
        action={
          <Button size="lg" onPress={closeCartSheet}>
            Start shopping
          </Button>
        }
      />
    </View>
  )
}

function Lines({ view, store }: { view: CartView; store?: Store }) {
  const count = itemCount(view.items)
  const mrp = mrpTotalCents(view.items)
  return (
    <>
      <View style={styles.card}>
        {store && store.id === view.storeId ? (
          <View style={styles.delivery}>
            <View style={styles.timerTile} aria-hidden>
              <Timer size={20} color={colors.ink} />
            </View>
            <View style={styles.flex}>
              <Text variant="h3" heading={3}>
                {`Delivery in ${store.promisedMinutes} minutes`}
              </Text>
              <Text variant="small" tone="inkMuted">
                {`Shipment of ${count} ${count === 1 ? 'item' : 'items'}`}
              </Text>
            </View>
          </View>
        ) : null}
        {view.items.map((line) => (
          <CartLineRow key={line.product.id} storeId={view.storeId} line={line} />
        ))}
      </View>
      {view.shortfallCents > 0 ? (
        <StatusMessage tone="warning">{`Add ${formatInr(view.shortfallCents)} more for free delivery.`}</StatusMessage>
      ) : null}
      <View style={styles.card}>
        <Text variant="h3" heading={3}>
          Bill details
        </Text>
        <View style={styles.between}>
          <Text>Items total</Text>
          <View style={styles.amounts}>
            {mrp > view.subtotalCents ? (
              <Text variant="body" tone="inkMuted" tabular accessibilityLabel={`MRP ${formatInr(mrp)}`} style={styles.struck}>
                {formatInr(mrp)}
              </Text>
            ) : null}
            <Text tabular>{formatInr(view.subtotalCents)}</Text>
          </View>
        </View>
        <View style={styles.between}>
          <Text>Delivery fee</Text>
          <Text tabular>{view.deliveryFeeCents === 0 ? 'FREE' : formatInr(view.deliveryFeeCents)}</Text>
        </View>
        <View style={[styles.between, styles.total]}>
          <Text variant="h3">
            Grand total
          </Text>
          <Text variant="h3" tabular>
            {formatInr(view.totalCents)}
          </Text>
        </View>
      </View>
      <Text variant="small" tone="inkMuted" style={styles.note}>
        Orders cannot be cancelled once packing starts.
      </Text>
    </>
  )
}

// One line: the image, name, unit and price, its Stepper, and under it the failed write (or the Remove of an out-of-stock line).
function CartLineRow({ storeId, line }: { storeId?: string; line: CartLine }) {
  const { product } = line
  const quantity = useLineQuantity(storeId, product.id, line.quantity)
  const [failure, write] = useLineWrite(storeId, product)
  const max = maxQuantity(product)
  return (
    <View style={styles.line}>
      <View style={styles.row}>
        <ImageTile uri={imageUri(product.imageUrl)} size={56} />
        <View style={styles.flex}>
          <Text numberOfLines={2}>{product.name}</Text>
          <Text variant="small" tone="inkMuted">
            {product.unitLabel}
          </Text>
          <Price cents={product.priceCents * line.quantity} />
        </View>
        <Stepper label={product.name} value={quantity} max={max} onChange={write} />
      </View>
      {max === 0 ? (
        <Button variant="ghostDanger" size="compact" accessibilityLabel={`Remove ${product.name}`} onPress={() => write(0)}>
          Remove
        </Button>
      ) : null}
      <CartWriteAlert message={failure} />
    </View>
  )
}

// The grand total and the checkout link; below the minimum order, the block that says how much is missing instead.
function CartFooter({ view }: { view: CartView }) {
  const token = useToken()
  if (view.subtotalCents < view.minOrderCents) {
    return (
      <View style={styles.footer}>
        <View style={styles.minimum}>
          <Text style={styles.semibold}>
            {`Minimum order is ${formatInr(view.minOrderCents)}. Add ${formatInr(view.minOrderCents - view.subtotalCents)} more to check out.`}
          </Text>
        </View>
      </View>
    )
  }
  const href = token ? '/checkout' : { pathname: '/sign-in', params: { returnTo: '/checkout' } }
  return (
    <View style={styles.footer}>
      <Link href={href} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Proceed to checkout" onPress={closeCartSheet} style={styles.proceed}>
          <View>
            <Text variant="body" tone="onAccent" tabular style={styles.bold}>
              {formatInr(view.totalCents)}
            </Text>
            <Text variant="small" tone="onAccent">
              TOTAL
            </Text>
          </View>
          <View style={styles.proceedRight}>
            <Text variant="button" tone="onAccent">
              Proceed
            </Text>
            <ChevronRight size={16} color={colors.onAccent} />
          </View>
        </Pressable>
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  body: {
    gap: 12,
    paddingTop: 12,
  },
  flex: {
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    padding: 12,
    gap: 12,
  },
  delivery: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timerTile: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  amounts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  total: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  note: {
    paddingHorizontal: 4,
  },
  empty: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingTop: 12,
  },
  minimum: {
    minHeight: 52,
    borderRadius: radius.card,
    backgroundColor: colors.canvas,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  semibold: {
    fontFamily: fontFamily(600),
    textAlign: 'center',
  },
  proceed: {
    minHeight: 52,
    borderRadius: radius.card,
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proceedRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bold: {
    fontFamily: fontFamily(700),
  },
})
