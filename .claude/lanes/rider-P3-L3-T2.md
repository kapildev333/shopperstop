# rider-P3-L3-T2 - e2e suite, test only (worker)
Status: done (task 2), committed as `test:`; the red `make e2e` run is the manager's (task 6.1).
## Doing
Task 2 written: `playwright.config.ts`, `e2e/global-setup.ts`, `e2e/helpers.ts`, `e2e/smoke.spec.ts`, `e2e/deliveries.spec.ts`, `e2e/flow.spec.ts`, `e2e/phone-layout.spec.ts`. The `e2e` script was already in `apps/rider/package.json` from task 1, so it is untouched.
## Found
- Brief vs design, location customer: the brief named the demo customer `demo@shopperstop.local` for the location read. design.md (task 2.2, Decision 19) reads the location with the shopper's core token, the customer who placed the ready order (`readyOrder` makes a fresh shopper's order). Followed design: the demo customer does not own the order, and the rider service answers 404 to another customer. Needs a yes or no from the team lead.
- Brief vs design, rider sign-in: the brief has the deliveries spec sign in as rider1 in the UI. design.md says the UI sign-in runs once per rider per run (smoke uses rider1, the cross-app flow rider2), and every other test uses an API token. Followed design: deliveries and phone layout enter with `riderToken` plus `asRider`.
- Phone layout tap-target check: design does not say which links are "button-styled". Used the computed display: a link not `inline` must be 44 px tall, buttons always. Ceiling: a plain-text link styled with `display: block` and short would be flagged; adjust if the walk finds a false positive.
- Cross-app flow: the customer's order is placed on web's `/checkout` (`Place order (COD)`), but cart and address are set through core's API (`fillCart`, `addAddress`) before the browser opens, not through web's search and add steps. Those steps are covered by web's own `flows.spec.ts`.
- Rider card on tracking: `webRiderCard = false` in `flow.spec.ts` records `skipped-step`; the two API checks are hard.
## Requests
- To the manager: the red `make e2e` run (task 6.1) should fail on missing pages (sign-in form, Ready list, delivery page), not on config. The global setup needs both `SHOPPERSTOP_CORE_DATABASE_URL` and `SHOPPERSTOP_RIDER_DATABASE_URL` pointing at `_e2e` databases, which `make e2e` sets.
- To T3 (rider-P3-L3-T3): `src/ready.tsx` line 4 imports `ButtonLink` unused, and `src/ready.test.tsx` lines 189 and 210 use `exact` in a role option. These fail `npm run lint` and `npm run typecheck` in the worktree right now; they are T3's files and I did not touch them.
## Blockers
None.
## Gates
- `npm run lint --workspace apps/rider`: fails only on `src/ready.tsx` 4:18 (T3's file, in progress). `e2e/` and `playwright.config.ts` are clean (checked with `tsc -p` and the workspace lint output, which lists no e2e file).
- `npm run typecheck --workspace apps/rider`: 3 errors, all in `src/ready.test.tsx` (T3). None in `e2e/` or `playwright.config.ts`.
- `openspec validate --all --strict`: Totals 17 passed, 0 failed.
- Not run, per brief: `make test-web`, `make e2e`, Playwright.
