import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { createLink } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ShoppingCart } from 'lucide-react'
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorBanner,
  Price,
  Sheet,
  Skeleton,
  Stepper,
  StatusMessage,
  cn,
  formatInr,
} from '@shopperstop/ui'
import { api } from './api'
import { setLine, useAsked, useCart } from './cart'
import { itemCount, maxQuantity, type CartLine, type CartView } from './guest-cart'
import { ImageTile } from './product-card'

const RouterButtonLink = createLink(ButtonLink)

// The drawer's open flag is a module store, like the pincode sheet's: the banner, the bar and the sheet sit in different parts of the root.
let open = false
const listeners = new Set<() => void>()

export function openCart() {
  open = true
  listeners.forEach((listener) => listener())
}

export function closeCart() {
  open = false
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function useCartOpen() {
  return useSyncExternalStore(subscribe, () => open)
}

const countLabel = (count: number) => (count === 1 ? '1 item' : `${count} items`)

export function CartSheet() {
  const isOpen = useCartOpen()
  const { view } = useCart()
  // The cached answer object, not the flag: a new replaced answer opens the drawer once; the same answer does not reopen it after Close.
  const replacedAnswer = view?.replaced ? view : undefined
  useEffect(() => {
    if (replacedAnswer) openCart()
  }, [replacedAnswer])
  return (
    <Sheet open={isOpen} onClose={closeCart} title="Your cart">
      <div className="flex flex-col gap-4">
        <CartBody />
      </div>
    </Sheet>
  )
}

// Mounted only while the sheet is open, so each open reads the cart afresh.
function CartBody() {
  const { view, signedIn, isError, refetch } = useCart()
  // The cart already shown stays when a refetch after a failed write fails too: view is checked before isError.
  if (!view && isError) return <ErrorBanner message="Could not load your cart." onRetry={refetch} />
  if (!view) return <Skeleton variant="list" count={3} />
  return <CartContent view={view} signedIn={signedIn} />
}

export const storeKey = (id: string) => ['store', id] as const

// Names the store the cart was at, from core's public store read; "another store" while that is unknown, pending or failed.
export function ReplacedNotice({ storeId }: { storeId?: string }) {
  const { data: store } = useQuery({
    queryKey: storeKey(storeId ?? ''),
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await api.GET('/stores/{id}', { params: { path: { id: storeId ?? '' } } })
      if (error) throw error
      return data
    },
  })
  return (
    <StatusMessage tone="warning">
      Your cart from {store?.name ?? 'another store'} was replaced. A cart holds products from one store.
    </StatusMessage>
  )
}

function CartContent({ view, signedIn }: { view: CartView; signedIn: boolean }) {
  const notice = view.clamped ? (
    <StatusMessage tone="warning">Some quantities were lowered to what the store has.</StatusMessage>
  ) : null
  if (!view.storeId || view.items.length === 0) {
    return (
      <>
        {notice}
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Add products from the store to see them here."
          action={
            <Button variant="secondary" onClick={closeCart}>
              Continue shopping
            </Button>
          }
        />
      </>
    )
  }
  const { storeId, subtotalCents, deliveryFeeCents, totalCents, minOrderCents, shortfallCents } = view
  const belowMinimum = subtotalCents < minOrderCents
  return (
    <>
      {view.replaced && <ReplacedNotice storeId={view.replacedStoreId} />}
      {notice}
      <ul className="flex flex-col divide-y divide-line">
        {view.items.map((line) => (
          <CartLineRow key={line.product.id} storeId={storeId} line={line} />
        ))}
      </ul>
      <dl className="flex flex-col gap-2 text-body text-ink">
        <SummaryRow label="Subtotal">
          <Price cents={subtotalCents} />
        </SummaryRow>
        <SummaryRow label="Delivery fee">
          {deliveryFeeCents === 0 ? <span className="font-semibold text-accent">Free</span> : <Price cents={deliveryFeeCents} />}
        </SummaryRow>
        <SummaryRow label="Total" className="font-semibold">
          <Price cents={totalCents} />
        </SummaryRow>
      </dl>
      {shortfallCents > 0 && <StatusMessage>Add {formatInr(shortfallCents)} more for free delivery</StatusMessage>}
      {belowMinimum ? (
        <>
          <StatusMessage tone="warning">
            Minimum order is {formatInr(minOrderCents)}. Add {formatInr(minOrderCents - subtotalCents)} more to check out.
          </StatusMessage>
          <Button size="lg" className="w-full" disabled>
            Proceed to checkout
          </Button>
        </>
      ) : signedIn ? (
        // ponytail: a plain link (full load) until web-P2-L4 adds the /checkout route and this becomes a RouterButtonLink.
        <ButtonLink size="lg" className="w-full" href="/checkout" onClick={closeCart}>
          Proceed to checkout
        </ButtonLink>
      ) : (
        <RouterButtonLink
          size="lg"
          className="w-full"
          to="/sign-in"
          search={{ returnTo: '/checkout' }}
          onClick={closeCart}
        >
          Proceed to checkout
        </RouterButtonLink>
      )}
    </>
  )
}

function SummaryRow({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex justify-between', className)}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

// Its own component so it can read the pending count of its line; the write goes to the cart's store, never the resolved one.
function CartLineRow({ storeId, line }: { storeId: string; line: CartLine }) {
  const { product, quantity } = line
  const pending = useAsked(storeId, product.id)
  const max = maxQuantity(product)
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="w-14 shrink-0">
        <ImageTile src={product.imageUrl} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-ink">{product.name}</p>
        <p className="text-small text-ink-muted">{product.unitLabel}</p>
        <Price cents={product.priceCents} mrpCents={product.mrpCents} />
      </div>
      <Stepper
        value={pending ?? quantity}
        max={max}
        label={product.name}
        onChange={(next) => void setLine(storeId, product, next)}
      />
      {max === 0 && (
        <Button variant="ghost-danger" aria-label={`Remove ${product.name}`} onClick={() => void setLine(storeId, product, 0)}>
          Remove
        </Button>
      )}
    </li>
  )
}

// The bar: phone only, shown only while the cart has lines. It brings its own spacer so the last row clears it; main is untouched.
export function CartBar() {
  const { view } = useCart()
  if (!view || itemCount(view) === 0) return null
  return (
    <>
      <div aria-hidden className={view.replaced ? 'h-40 sm:hidden' : 'h-24 sm:hidden'} />
      <aside
        aria-label="Cart summary"
        className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-2 bg-surface px-4 py-3 shadow-sheet sm:hidden"
      >
        {view.replaced && <ReplacedNotice storeId={view.replacedStoreId} />}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-body font-semibold text-ink">{countLabel(itemCount(view))}</span>
            <Price cents={view.totalCents} />
          </div>
          <Button aria-haspopup="dialog" onClick={openCart}>
            View cart
          </Button>
        </div>
      </aside>
    </>
  )
}

// The banner's cart button: desktop only; the bar takes its place on phone.
export function CartButton() {
  const { view } = useCart()
  const count = view ? itemCount(view) : 0
  return (
    // max-sm, not hidden: Button's base is inline-flex, and a base-level hidden loses to it in the built CSS.
    <Button variant="secondary" aria-haspopup="dialog" className="max-sm:hidden" onClick={openCart}>
      <ShoppingCart size={16} aria-hidden />
      {!view || count === 0 ? (
        'Cart'
      ) : (
        <>
          <span>{countLabel(count)}</span> <span className="tabular-nums">{formatInr(view.totalCents)}</span>
        </>
      )}
    </Button>
  )
}
