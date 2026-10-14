import { useId, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
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
import { useCart } from './cart'
import { openCart, Totals } from './cart-drawer'
import { useStore, type Store } from './catalog'
import type { CartView } from './guest-cart'
import { LineRow } from './order-parts'

export function CheckoutPage() {
  const { view, isError, refetch } = useCart()
  const addresses = useAddresses()
  const store = useStore(view?.storeId)
  const [chosen, setChosen] = useState<string>()

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
  return (
    <Frame>
      <div className="grid gap-6 lg:grid-cols-2">
        <AddressCard addresses={addresses} selected={selected} onChoose={setChosen} />
        <SummaryCard view={view} store={store.data} canPlace={!!selected && !belowMinimum} />
      </div>
    </Frame>
  )
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
}: {
  addresses: ReturnType<typeof useAddresses>
  selected?: Address
  onChoose: (id: string) => void
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

function SummaryCard({ view, store, canPlace }: { view: CartView; store?: Store; canPlace: boolean }) {
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
          />
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
      <Button size="lg" className="w-full" disabled={!canPlace}>
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
