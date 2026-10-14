import { useId, useState, type ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
  StatusMessage,
  buttonClass,
  formatInr,
} from '@shopperstop/ui'
import { AddressDialog } from './address-dialog'
import { addAddress, useAddresses, type Address } from './addresses'
import { cartKey, setLine, useCart } from './cart'
import { openCart, Totals } from './cart-drawer'
import { useStore, type Store } from './catalog'
import { queryClient, type ApiError } from './api'
import { postOrder, cartEmptied, placeOrder } from './orders'
import { type CartLine, type CartProduct, type CartView } from './guest-cart'
import { LineRow } from './order-parts'
import { useToken } from './session'

// A refusal the page shows: its message, and the address it is about when core named one.
type Refusal = { message: string; addressId?: string }

export function CheckoutPage({ send = postOrder }: { send?: typeof postOrder }) {
  const { view, isError, refetch } = useCart()
  const addresses = useAddresses()
  const store = useStore(view?.storeId)
  const navigate = useNavigate()
  const token = useToken() ?? ''
  const [chosen, setChosen] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<Refusal>()
  // The address core refused, with the address list as it was read then: the badge goes once the list is read again.
  const [refused, setRefused] = useState<{ addressId: string; listedAt: number }>()
  // Product id to the line's quantity when core refused it: the line stays marked while it still has that quantity.
  const [short, setShort] = useState<Record<string, number>>({})

  // A view checks its data before its error: a failed refetch keeps the cart on screen.
  if (view === undefined) {
    return (
      <Frame>
        {isError ? <ErrorBanner message="Could not load your cart." onRetry={refetch} /> : <Skeleton variant="list" count={3} />}
      </Frame>
    )
  }
  if (view.items.length === 0) {
    return (
      <Frame>
        <Card className="p-6">
          <EmptyState
            title="Your cart is empty"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/" className={buttonClass({ variant: 'primary' })}>
                  Continue shopping
                </Link>
                <Link to="/orders" className={buttonClass({ variant: 'secondary' })}>
                  Your orders
                </Link>
              </div>
            }
          />
        </Card>
      </Frame>
    )
  }

  const list = addresses.data ?? []
  // The address chosen here, else the default, else the first listed; the page keeps no other copy of it.
  const selected = list.find((address) => address.id === chosen) ?? list.find((address) => address.isDefault) ?? list[0]
  const belowMinimum = view.subtotalCents < view.minOrderCents

  // The answer decides the page: an order goes to its page, an empty cart to the history, anything else stays here with its message.
  async function place() {
    // Belt and braces: the button is disabled while busy, so no press reaches here.
    if (busy) return
    if (!selected) return
    setBusy(true)
    setRefusal(undefined)
    setRefused(undefined)
    setShort({})
    const { order, error } = await placeOrder(selected.id, send)
    if (order) {
      await navigate({ to: '/orders/$id', params: { id: order.id } })
      return
    }
    if (error && cartEmptied(error)) {
      await navigate({ to: '/orders' })
      return
    }
    setBusy(false)
    if (error?.code === 'out_of_stock') {
      // placeOrder has read the cart again: the lines as core holds them now.
      const lines = queryClient.getQueryData<CartView>(cartKey(token))?.items ?? []
      setShort(
        Object.fromEntries(
          lines.filter((line) => error.productIds?.includes(line.product.id)).map((line) => [line.product.id, line.quantity]),
        ),
      )
    }
    const failure = refusalOf(error, store.data?.name ?? 'The store', selected.id)
    setRefusal(failure)
    if (failure.addressId) setRefused({ addressId: failure.addressId, listedAt: addresses.dataUpdatedAt })
  }

  // Choosing another address clears an address refusal's alert; the refused address keeps its badge.
  const choose = (id: string) => {
    setChosen(id)
    setRefusal((current) => (current?.addressId ? undefined : current))
  }
  const refusedId = refused && refused.listedAt === addresses.dataUpdatedAt ? refused.addressId : undefined

  // Through the cart's queue, like every cart write; the store is the cart's own.
  const remove = (line: CartLine) => {
    if (view.storeId) void setLine(view.storeId, line.product, 0)
  }

  return (
    <Frame>
      <div className="grid gap-6 lg:grid-cols-2">
        <AddressCard addresses={addresses} selected={selected} onChoose={choose} refusedId={refusedId} />
        <SummaryCard
          view={view}
          store={store.data}
          canPlace={!!selected && !belowMinimum}
          busy={busy}
          refusal={refusal}
          short={short}
          onPlace={() => void place()}
          onRemove={remove}
        />
      </div>
    </Frame>
  )
}

// What the customer reads for a refusal. Core's own messages are lower-case API text and are never shown.
function refusalOf(error: ApiError | undefined, storeName: string, addressId: string): Refusal {
  if (error?.code === 'out_of_stock') return { message: 'Some products are not available in the quantity you chose.' }
  if (error?.code === 'not_serviceable') {
    return error.field === 'addressId'
      ? { message: `${storeName} does not deliver to this address. Choose another address or add one.`, addressId }
      : { message: `${storeName} is closed right now.` }
  }
  if (error?.field === 'subtotal') return { message: "Your cart is below the store's minimum order." }
  return { message: 'Could not place your order. Try again.' }
}

// Why a marked line is marked: out of stock, or short of the quantity asked for.
function shortText(product: CartProduct, quantity: number): string {
  if (!product.inStock) return 'Out of stock'
  if (product.quantity < quantity) return `Only ${product.quantity} left`
  return 'Not enough stock'
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Checkout" />
      {children}
    </div>
  )
}

function AddressCard({
  addresses,
  selected,
  onChoose,
  refusedId,
}: {
  addresses: ReturnType<typeof useAddresses>
  selected?: Address
  onChoose: (id: string) => void
  refusedId?: string
}) {
  const headingId = useId()
  const [adding, setAdding] = useState(false)
  const list = addresses.data
  const addButton = (
    <Button variant="secondary" onClick={() => setAdding(true)}>
      Add address
    </Button>
  )
  return (
    <Card role="region" aria-labelledby={headingId} className="flex flex-col gap-4 p-4 sm:p-6">
      <h2 id={headingId} className="text-h2 text-ink">
        Delivery address
      </h2>
      {list === undefined ? (
        addresses.isError ? (
          <ErrorBanner message="Could not load your addresses." onRetry={() => void addresses.refetch()} />
        ) : (
          <Skeleton variant="list" count={2} />
        )
      ) : list.length === 0 ? (
        <EmptyState title="No addresses yet" description="Add one to place the order." action={addButton} />
      ) : (
        <>
          <ul className="flex flex-col">
            {list.map((address) => (
              <li key={address.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-h3 text-ink">{address.label}</h3>
                    {address.isDefault && <Badge variant="accent">Default</Badge>}
                    {address.id === refusedId && <Badge variant="warning">Not delivered here</Badge>}
                  </div>
                  <p className="text-body text-ink">{address.line1}</p>
                  {address.line2 && <p className="text-body text-ink">{address.line2}</p>}
                  <p className="text-body text-ink-muted tabular-nums">{address.pincode}</p>
                </div>
                <Chip
                  selected={address.id === selected?.id}
                  aria-label={`Deliver to ${address.label}`}
                  onClick={() => onChoose(address.id)}
                >
                  Deliver here
                </Chip>
              </li>
            ))}
          </ul>
          <div>{addButton}</div>
        </>
      )}
      <AddressDialog
        open={adding}
        onClose={() => setAdding(false)}
        submit={async (values) => {
          // The address the customer just saved is chosen from core's answer, not from the refetched list.
          const { address, error } = await addAddress(values)
          if (address) onChoose(address.id)
          return error
        }}
      />
    </Card>
  )
}

function SummaryCard({
  view,
  store,
  canPlace,
  busy,
  refusal,
  short,
  onPlace,
  onRemove,
}: {
  view: CartView
  store?: Store
  canPlace: boolean
  busy: boolean
  refusal?: Refusal
  short: Record<string, number>
  onPlace: () => void
  onRemove: (line: CartLine) => void
}) {
  const headingId = useId()
  const belowMinimum = view.subtotalCents < view.minOrderCents
  return (
    <Card role="region" aria-labelledby={headingId} className="flex flex-col gap-4 p-4 sm:p-6">
      <h2 id={headingId} className="text-h2 text-ink">
        Order summary
      </h2>
      {store && (
        <div className="flex flex-col">
          <p className="text-body font-semibold text-ink">From {store.name}</p>
          <p className="text-small text-ink-muted">Delivery in {store.promisedMinutes} minutes</p>
        </div>
      )}
      <ul className="flex flex-col divide-y divide-line">
        {view.items.map((line) => (
          <LineRow
            key={line.product.id}
            name={line.product.name}
            unitLabel={line.product.unitLabel}
            imageUrl={line.product.imageUrl}
            priceCents={line.product.priceCents}
            quantity={line.quantity}
          >
            {short[line.product.id] === line.quantity && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="danger">{shortText(line.product, line.quantity)}</Badge>
                <Button variant="ghost-danger" aria-label={`Remove ${line.product.name}`} onClick={() => onRemove(line)}>
                  Remove
                </Button>
              </div>
            )}
          </LineRow>
        ))}
      </ul>
      <Totals subtotalCents={view.subtotalCents} deliveryFeeCents={view.deliveryFeeCents} totalCents={view.totalCents} />
      <p className="flex justify-between text-body text-ink">
        <span>Payment</span>
        <span>Cash on delivery</span>
      </p>
      {belowMinimum && (
        <StatusMessage tone="warning">
          Minimum order is {formatInr(view.minOrderCents)}. Add {formatInr(view.minOrderCents - view.subtotalCents)} more to place
          the order.
        </StatusMessage>
      )}
      {refusal && <ErrorBanner message={refusal.message} />}
      <Button size="lg" className="w-full" loading={busy} disabled={!canPlace} onClick={onPlace}>
        Place order (COD)
      </Button>
      <div>
        <Button variant="ghost" onClick={openCart}>
          Edit cart
        </Button>
      </div>
    </Card>
  )
}
