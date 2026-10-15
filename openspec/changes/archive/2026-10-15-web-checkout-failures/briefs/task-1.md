# Brief: web-checkout-failures task 1 (worker)

- LANE-ID: web-P2-L11-T1 (worker log `.claude/lanes/web-P2-L11-T1.md`, format in `.claude/lanes/README.md`); team lead web-P2-L11
- Area: web
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/web-P2-L11`, branch `lane/web-P2-L11-checkout-failures`. Commit there; never push.
- Change: `openspec/changes/web-checkout-failures/`, task 1 "Checkout failures". Read `proposal.md`, `specs/web-app/spec.md`, `design.md`, `tasks.md` first.
- Scope paths (edit nothing else):
  - `apps/web/src/checkout.tsx`, `apps/web/src/checkout.test.tsx`
  - `openspec/changes/web-checkout-failures/tasks.md` (checkboxes only)
  - `.claude/lanes/web-P2-L11-T1.md`
  - Not `packages/ui`, not `cart.ts`, not `orders.ts`: if any seems to need a change, stop and report.
- Scenarios: web-app › "Customer cart write failure" › Failed removal at checkout; "Customer checkout refusals" › Placement fails; "Customer checkout unconfirmed placement" › Core cannot be reached at placement, Unconfirmed placement that emptied the cart.

## Commit 1: `test: checkout failures`

All in `src/checkout.test.tsx`, using its helpers (`seed`, `sender`, `placeButton`, `taaza`, `product`, `renderInRouter`). Imports: add `afterEach, vi` to the vitest import and `emptyCart` to the `./guest-cart` import. Under the imports: `afterEach(() => vi.unstubAllGlobals())`. Core "cannot be reached" is `test-setup.ts`'s default `fetch`; do not stub it for that.

1. "failed removal at checkout", appended:
   - `const out = product({ id: '00000000-0000-4000-8000-000000000602', name: 'Amul Butter', slug: 'amul-butter', inStock: false, quantity: 0 })`
   - `seed({ lines: [[taaza, 4], [out, 1]], storeOverrides: { minOrderCents: 9900 } })`
   - `const { send } = sender({ error: { code: 'out_of_stock', message: 'short', productIds: [out.id] } })`; `renderInRouter(<CheckoutPage send={send} />)`
   - click "Place order (COD)" (`userEvent`); `const summary = screen.getByRole('region', { name: 'Order summary' })`; `const butterLine = () => within(summary).getByText('Amul Butter').closest('li') as HTMLElement`
   - `await userEvent.click(await within(summary).findByRole('button', { name: 'Remove Amul Butter' }))`
   - `expect(await within(butterLine()).findByRole('alert')).toHaveTextContent('Could not reach ShopperStop. Try again.')`; the line still has `getByText('Out of stock')` and the "Remove Amul Butter" button. Look only `within(butterLine())`: the refusal alert sits outside the line.
2. "placement fails", changed: drop the `calls` counter and the real `postOrder` call. `const { send, asked } = sender({ error: { code: 'validation', message: 'below minimum', field: 'subtotal' } }, { error: { code: 'validation', message: 'unknown address', field: 'addressId' } })`; the assertions stay as they are, with `expect(asked).toHaveLength(2)` in place of `expect(calls).toBe(2)`. Green before and after.
3. "core cannot be reached at placement", appended:
   - `seed({ lines: [[taaza, 4]], storeOverrides: { minOrderCents: 9900 } })`; `const router = renderInRouter(<CheckoutPage send={postOrder} />)` (the real request)
   - click "Place order (COD)"; `expect(await screen.findByRole('alert')).toHaveTextContent('We could not confirm your order. It may have been placed, so check Your orders before you place it again.')`
   - `const summary = screen.getByRole('region', { name: 'Order summary' })`; `expect(within(summary).getByRole('link', { name: 'Your orders' })).toHaveAttribute('href', '/orders')`; `within(summary).getByText('Amul Taaza')` is in the document; `router.state.location.pathname` is `'/'`; `placeButton()` is enabled and has no `aria-busy`.
4. "unconfirmed placement that emptied the cart", appended:
   - first line: `vi.stubGlobal('fetch', async (request: Request) => { if (new URL(request.url).pathname === '/api/core/v1/me/cart') return new Response(JSON.stringify(cartView(emptyCart)), { status: 200, headers: { 'Content-Type': 'application/json' } }); throw new TypeError('fetch failed') })` with the comment `// Core placed the order but its answer was lost: the cart read again is empty.`
   - `seed({ lines: [[taaza, 4]], storeOverrides: { minOrderCents: 9900 } })`; `const { send } = sender({ error: { code: 'internal', message: 'Could not reach ShopperStop. Try again.' } })`; `const router = renderInRouter(<CheckoutPage send={send} />)`
   - click "Place order (COD)"; `await waitFor(() => expect(router.state.location.pathname).toBe('/orders'))`

Red on this commit: exactly 1, 3 and 4 (1: no alert in the line; 3: the alert reads "Could not place your order. Try again."; 4: the location stays `/`). Everything else green, lint and typecheck green. Write the red list in the commit body.

## Commit 2: `feat: checkout failures`

Exactly design.md, all in `src/checkout.tsx`:
- Decision 1: `ShortLine` as written; `SummaryCard` renders `{short[line.product.id] === line.quantity && <ShortLine storeId={view.storeId} line={line} />}` inside `LineRow`; remove `CheckoutPage`'s `remove`, `SummaryCard`'s `onRemove` prop and its type; import `useLineWrite` instead of `setLine` from `./cart`.
- Decision 2: `unconfirmed?: true` on `Refusal`; the `internal` branch in `refusalOf` before its final `return`, with its comment; the "Your orders" `Link` after the refusal's `ErrorBanner` in `SummaryCard`.
- Decision 3: the `emptied` line and the widened `if` in `place()`, with its comment.

Do not add:
- `onRetry` on any banner, a timer, a dismiss button, a dialog
- a disabled state on "Place order (COD)" after `internal`
- any change to `placeOrder`, `postOrder`, `setLine`, `useLineWrite` or `packages/ui`
- copy beyond the one sentence and the link text "Your orders"

Tick 1.1 and 1.2 in `tasks.md` as each commit lands.

## Gates

From the worktree root, prefix `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`:
- `npm run build --workspace packages/ui`
- `npm run lint --workspace apps/web`
- `npm run typecheck --workspace apps/web`
- `npm run test --workspace apps/web -- --run` (run `src/checkout.test.tsx` three times: the cart queue is timing-sensitive)
- `npm run build --workspace apps/web`
- `git status` clean after the build
- `openspec validate web-checkout-failures --strict`

No Playwright and no docker by the worker. Commit as the repo's configured author, no trailers. Report the commit hashes, the red list, the gate results and any deviation in your lane log.
