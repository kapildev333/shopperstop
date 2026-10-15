# web-P2-L10 - web-cart-write-failure: tell the customer when a cart write fails (team lead)
Status: done
## Doing
Acceptance (`/opsx:verify web-cart-write-failure`) on 7fd36ba: PASS, 5 of 5 scenarios.
## Found
- Change: `openspec/changes/web-cart-write-failure/` (proposal; `web-app` delta: 2 ADDED requirements, "Customer cart write failure" and "Customer cart write failure cleared", 5 scenarios; design; tasks, one task; `briefs/task-1.md`). No `docs/design/web-P2-L10.md`: design.md is enough.
- Root cause: `setLine` in `src/cart.ts` drops the error `call()` returns; the `Stepper` snaps back when `asked` is cleared in `finally`. `call()` and the middleware already map every failure to an envelope with a message, so no new mapping and no new copy.
- Placement (design Decision 1): an `ErrorBanner` under the control the customer tapped (card, product page, drawer line incl. Remove). The bar is phone only and absent on an empty cart, the header button desktop only, the drawer only while open, a toast would overlap the bar and is a new ui pattern.
- State (Decision 2): component state per control through `useLineWrite` in `cart.ts`, fed by `setLine`'s new return value; clears on the next tap and on unmount, and shows only where the tap was (no double announcement with the drawer).
- Stock: core never refuses on stock; it clamps with 200 `clamped: true`, and the drawer's existing "Some quantities were lowered" notice stays the only stock message. `PUT /me/cart/items` answers 200, 400 `validation`, 401.
- Ceilings in design.md: checkout's Remove stays silent; core's 400 copy is terse ("product not available"); the card grows while the message shows; the product page has no test of its own; the in-flight overtaken check is verified by reading.
- `openspec validate web-cart-write-failure --strict` valid. Vitest not run by this lane (design only).
- 2026-10-15, answer to web-P2-L10-T1 (seam for "core's refusal is shown"): option (c), admin's seam. `api.ts` gets `baseUrl: \`${location.origin}/api/core/v1\`` and `fetch: (request) => globalThis.fetch(request)`; `test-setup.ts` sets a default `fetch` that throws `TypeError('fetch failed')` so "cannot reach" tests stay deterministic and off the network; the refusal test uses `vi.stubGlobal` plus `vi.unstubAllGlobals`. Rejected the `Request` shim and the api.test.ts-only cover. Design wording corrected: it was `Request` rejecting the relative URL, not `fetch`. Rehearsed in a scratch worktree (T1's uncommitted feature diff plus the seam, removed after): Vitest 147/147, typecheck and lint clean. 1.1 unticked until commit 1b lands.
- 2026-10-15, acceptance on 7fd36ba: PASS. Scenario to test, each green here (cart files 29 of 29) and in the manager's `make test-web` (web 149):
  - Customer cart write failure › Failed write tells the customer: `src/cart.test.tsx` "failed write tells the customer" (alert text, count 1). Red on 24436e4.
  - › Core's refusal is shown: `src/cart-write-failure.test.tsx` "core's refusal is shown" (400 envelope through `vi.stubGlobal`, alert "product not available", count 1). Red on 9b3fdf6.
  - Customer cart write failure cleared › Next tap clears the failure: `src/cart.test.tsx` "next tap clears the failure" (gone synchronously, back after the second failure). Red on 24436e4.
  - › Overtaken change shows no failure: "overtaken write shows no failure" (skip path, red on 24436e4) and the pin "overtaken in-flight write shows no failure" (86a0ec4, mutation-checked by the worker).
  - › Failed write in the drawer: `src/cart-drawer.test.tsx` "failed write in the drawer" (alert within the drawer, count 1, none after close and reopen). Red on 24436e4.
- Code matches design Decisions 2 to 5; one deviation, approved: the re-read after a failed write is no longer awaited (review nit 2, test f07ef4d red, fix 7fd36ba). design.md Decision 3 updated, and the overlap is now a Ceilings line: benign, because a later success cancels the re-read and a later failure's invalidate restarts it. The "verified by reading" note on the in-flight overtaken check is replaced by the pin.
- Nothing extra landed: the diff is the brief's scope (api.ts, auth.test.ts comment, test-setup.ts, cart.ts, product-card.tsx, p.$slug.tsx, cart-drawer.tsx, three test files) plus lane logs and this change's files. No `packages/ui`, no `checkout.tsx`. Test commits precede feat/fix.
- Manager evidence accepted for the browser: Chromium probe against real core with core stopped (one alert under the card's Stepper, count back, one alert on repeat, none after restart, drawer alert only in the drawer, 390 and 1280 no horizontal scroll); `make e2e` admin 10, web 40. The 400 path is Vitest only (core cannot be made to refuse a live tap without deactivating a product mid-test); accepted.
- `openspec validate web-cart-write-failure --strict` valid.
## Requests
- to web manager: open the PR; archive the change by PR after it merges; add to Backlog: checkout's Remove on an out-of-stock line still fails silently.
## Blockers
