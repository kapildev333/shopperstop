# web-P2-L11-T1 - web-checkout-failures task 1: checkout failures (worker)
Status: done
## Doing
Task 1 landed on `lane/web-P2-L11-checkout-failures`: red `0af6d54` (test: checkout failures), feat `0ae4bb3` (feat: checkout failures), this log as chore. Tasks 1.1 and 1.2 ticked. Handed back to the team lead for `/opsx:verify web-checkout-failures`. No Playwright, no servers, no Docker.
## Found
- Red on `0af6d54` (vitest `src/checkout.test.tsx`, 3 failed, 20 passed; the three new tests, nothing else red):
  - "failed removal at checkout": `Unable to find role="alert"` under the Amul Butter line.
  - "core cannot be reached at placement": received "Could not place your order. Try again.", expected the "We could not confirm your order..." sentence.
  - "unconfirmed placement that emptied the cart": `expected '/' to be '/orders'`.
  - "placement fails" (changed to two sender answers, `asked` length 2): green before and after.
- Lint and typecheck green on the red commit.
- Test-authoring fix before commit 1: the first draft of "failed removal at checkout" used the synchronous `placeButton()` right after `renderInRouter`, which failed on "Unable to find role button" (the page had not rendered). It now awaits `findByRole('button', { name: 'Place order (COD)' })`, as the other tests do. The committed version's red reason is the alert, as the brief expects.
- Code on `0ae4bb3` follows design Decisions 1 to 3 exactly: `ShortLine` (per line, `useLineWrite`), `CheckoutPage` `remove` and `SummaryCard` `onRemove` removed, `setLine` import replaced by `useLineWrite`; `Refusal.unconfirmed`, the `internal` branch in `refusalOf`, the "Your orders" link after the refusal banner; the `emptied` check in `place()`. No change to `placeOrder`, `postOrder`, `setLine`, `useLineWrite`, `packages/ui`, `cart.ts`, `orders.ts`.
- Gates on `0ae4bb3`: `packages/ui` build exit 0; lint exit 0; typecheck exit 0; full web Vitest 152 of 152 in 26 files (149 at the L10 tip plus the 3 new); `apps/web` build exit 0; `git status` clean after the build; `openspec validate web-checkout-failures --strict` valid.
- Flakiness: `src/checkout.test.tsx` 23 of 23 on each of 3 runs.
- Other web lane logs read at start and finish: `web-P2-L10-T1`, `web-P2-L10`, `web-P2-L11` (team lead), and a grep of the other `web-*` logs for checkout and L11 requests. Nothing addressed to this lane. The fetch seam used here is the one `web-P2-L10-T1` documents: `vi.stubGlobal('fetch', …)` with `afterEach(() => vi.unstubAllGlobals())`, and `test-setup.ts`'s default `fetch` left alone for "cannot be reached".
- Ceilings from design.md still hold and are not changed here: the move to `/orders` after an emptied cart says nothing; with core down the alert and the link are all there is; "Place order (COD)" stays enabled after `internal`.
## Requests
- to web-P2-L11 (team lead): ready for `/opsx:verify web-checkout-failures`.
## Blockers
(none)
