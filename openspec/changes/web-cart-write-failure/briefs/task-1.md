# Brief: web-cart-write-failure task 1 (worker)

- LANE-ID: web-P2-L10-T1 (worker log `.claude/lanes/web-P2-L10-T1.md`, format in `.claude/lanes/README.md`); team lead web-P2-L10
- Area: web
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/web-P2-L10`, branch `lane/web-P2-L10-cart-write-failure`. Commit there; never push.
- Change: `openspec/changes/web-cart-write-failure/`, task 1 "Cart write failure message". Read `proposal.md`, `specs/web-app/spec.md`, `design.md`, `tasks.md` first.
- Scope paths (edit nothing else):
  - `apps/web/src/api.ts`, `apps/web/src/cart.ts`, `apps/web/src/product-card.tsx`, `apps/web/src/routes/p.$slug.tsx`, `apps/web/src/cart-drawer.tsx`
  - `apps/web/src/cart.test.tsx`, `apps/web/src/cart-drawer.test.tsx`, `apps/web/src/cart-write-failure.test.tsx` (new)
  - `openspec/changes/web-cart-write-failure/tasks.md` (checkboxes only)
  - `.claude/lanes/web-P2-L10-T1.md`
  - Not `packages/ui`, not `checkout.tsx`: if either seems to need a change, stop and report.
- Scenarios: web-app › "Customer cart write failure": Failed write tells the customer; Core's refusal is shown. "Customer cart write failure cleared": Next tap clears the failure; Overtaken change shows no failure; Failed write in the drawer.

## Commit 1: `test: cart write failure message`

Under jsdom a relative `fetch` throws, so every cart write already fails with "Could not reach ShopperStop. Try again." (see the existing "failed write returns to the cart's count"). Use the files' existing helpers (`resolveStore`, `serverCart`, `shownCount`, `seedServerCart`, `renderShell`, `openDrawer`, `koramangala`, `taaza`).

`src/cart.test.tsx`, appended:
1. "failed write tells the customer": `resolveStore()`, `setToken('t')`, `serverCart(koramangala, 1)` in `cartKey('t')`, render `<ProductCard product={product({ name: 'Amul Taaza' })} />` with `renderInRouter`; await the "Add one Amul Taaza" button; `fireEvent.click` it; `expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach ShopperStop. Try again.')`; `expect(shownCount()).toBe(1)`.
2. "next tap clears the failure": same setup and first tap, await the alert; `fireEvent.click` "Add one Amul Taaza" again; `expect(screen.queryByRole('alert')).toBeNull()` straight after (no await); then `expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach ShopperStop. Try again.')`.
3. "overtaken write shows no failure": same setup; two `fireEvent.click`s on "Add one Amul Taaza" in a row; `await waitFor(() => expect(shownCount()).toBe(1))`; `await screen.findByRole('alert')`; `expect(screen.getAllByRole('alert')).toHaveLength(1)`.

`src/cart-write-failure.test.tsx`, new. Core's answer is faked at the process boundary, as `src/auth.test.ts` does: `api.ts` captures `globalThis.fetch` when the client is created, so stub it in `vi.hoisted` before any import of the app:
```ts
vi.hoisted(() => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: { code: 'validation', field: 'productId', message: 'product not available' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch
})
```
Every request (the PUT and the refetch of `GET /me/cart` after it) answers that 400; the cached cart stays shown. Then 4. "core's refusal is shown": the same setup as test 1 (copy the small `resolveStore`/`serverCart` lines; do not export them from `cart.test.tsx`), one tap, `expect(await screen.findByRole('alert')).toHaveTextContent('product not available')`, `expect(shownCount()).toBe(1)` (or the group's text).

`src/cart-drawer.test.tsx`, appended:
5. "failed write in the drawer": `resolveStore()`, `seedServerCart([[taaza, 1]])`, `await renderShell()`, `const drawer = openDrawer()`; `fireEvent.click(within(drawer).getByRole('button', { name: 'Add one Amul Taaza' }))`; `expect(await within(drawer).findByRole('alert')).toHaveTextContent('Could not reach ShopperStop. Try again.')`; the drawer's group "Quantity of Amul Taaza" has text `/^1$/`; click `within(drawer).getByRole('button', { name: 'Close' })`; wait for no dialog; `openDrawer()` again and `expect(within(<new drawer>).queryByRole('alert')).toBeNull()`. Look only `within(drawer)`: Home's own load failures are alerts outside it.

All five must be red (no alert today) and every other test green; lint and typecheck green. Write the red list in the commit body.

## Commit 2: `feat: cart write failure message`

Exactly design.md:
- Decision 3: `api.ts`: `export` on `unreachable`, nothing else. `cart.ts` › `setLine` answers `Promise<ApiError | undefined>`; keep `call(...)`'s result as `error`; in the `!answered.cart` branch, after the `invalidateQueries`, `return asked.get(key)?.turn === mine ? (error ?? unreachable) : undefined` with the one-line comment; every other path answers `undefined` (guest: `dispatchGuest(...)` then `return undefined`).
- Decision 2: `useLineWrite(storeId, product)` in `cart.ts` as written in design.md; `useCartQuantity` returns `[quantity, write, failure]` using it.
- Decision 4: `{failure && <ErrorBanner message={failure} />}` in `product-card.tsx`, `routes/p.$slug.tsx` › `ProductDetail`, and `cart-drawer.tsx` › `CartLineRow` (the `<li>` restructure as written; the `Stepper` and Remove both call the row's `write`).

Do not add:
- `onRetry` on these banners, a timer, a dismiss button
- a module-level failure store, a new component or a new export beyond `unreachable` and `useLineWrite`
- new copy: the message is core's, or `unreachable`'s
- any change to `checkout.tsx`, `mergeGuestCart` or `clearCart`

Tick 1.1 and 1.2 in `tasks.md` as each commit lands.

## Gates

From the worktree root, prefix `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`:
- `npm run build --workspace packages/ui`
- `npm run lint --workspace apps/web`
- `npm run typecheck --workspace apps/web`
- `npm run test --workspace apps/web -- --run` (run `src/cart.test.tsx` and `src/cart-drawer.test.tsx` three times each: the queue is timing-sensitive)
- `npm run build --workspace apps/web`
- `git status` clean after the build
- `openspec validate web-cart-write-failure --strict`

No Playwright and no docker by the worker. Commit as the repo's configured author, no trailers. Report the commit hashes, the red list, the gate results and any deviation in your lane log.
