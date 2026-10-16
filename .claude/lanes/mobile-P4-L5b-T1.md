# mobile-P4-L5b-T1 - the §13 customer flow (`apps/mobile/e2e/flow.spec.ts`, task 1 of mobile-e2e-flow)
Status: done
## Doing
Done: test commit 3b63982 (`test: customer order to delivered against core`); tasks 1.1 and 1.2 ticked. Bite check recorded below, reverted, nothing committed broken.
## Found
- First run green (design.md Decision 5 allows it: the behaviour is merged). Targeted run `e2e/flow.spec.ts` 1/1 passed, 29.3 s; after the lint fix 1/1 passed, 25.5 s.
- Bite check: `Your order was delivered.` changed to `Your order was delivered!` on line 203 of `e2e/flow.spec.ts`. Result: `1 failed`, `> 203 |   await expect(main.getByText('Your order was delivered!', { exact: true })).toBeVisible({ timeout: 15_000 })`, `Error: expect(locator).toBeVisible() failed`, `element(s) not found`. Reverted with `git checkout --`; the file matches 3b63982.
- Labels as merged on main (no app change): "Account" (Home icon button), "Search products" (Home button and search box), "Back" (search, category, My account; My account's Back is `useBack`, which went to Home), "Proceed to checkout" (a link in the cart sheet), "Close" (the sheet's header button; the scrim button is "Close sheet"), "Place order", "Add address" / "Save address", "Delivering to Home", "No addresses yet", checkout lines "<qty> × <unitLabel>" (the brief's "<unit>" is `unitLabel`, e.g. "1 kg").
- Brief predictions held: My account's Back lands on Home; checkout lines read "<qty> × <unitLabel>". No stop needed.
- Helpers copied (`orderPick` returns `id`, `name`, `priceCents`, `unitLabel`; `staffHeaders`, `sheet`/`savePincode`, `quantityOf`, `cartBar`, `cartSheet`, `searchFor`). Two unused constants (`tokenKey`, `pincodeKey`) removed to clear lint before the commit.
- Picks: `orderPick` 6 (`a`) and 7 (`b`), `qa` from `minOrderCents`, as design.md Decision 2.
- `make e2e` run with the manager's slot: exit 0. Per-workspace summaries: admin 15 passed (11.6 s); mobile 26 passed (30.5 s), including `e2e/flow.spec.ts:78:5 › Customer order to delivered against core` (22.6 s); rider 7 passed (27.4 s), including its own `flow.spec.ts`; web 45 passed (39.1 s). Ports 18080, 18081, 15173-15176 free afterwards.
- Gates: `npm run build --workspace packages/ui` exit 0; `npm run lint --workspace apps/mobile` exit 0; `npm run typecheck --workspace apps/mobile` exit 0; `openspec validate --all --strict` 20 passed, 0 failed.
- Note for the manager: the targeted run needs `packages/ui` built first (the app's `@shopperstop/ui/format` import) and the Makefile's `E2E_ENV` (I ran a copy of that line through a scratch script, not `make e2e`, only for the red-run checks).
## Requests
none
## Blockers
none
