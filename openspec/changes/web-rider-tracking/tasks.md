# Tasks

Four tasks, one worker each, in order, on branch `lane/web-P3-L1-rider-tracking` in `.worktrees/web-P3-L1`. Read `design.md` first: Decisions 1 to 8 are the code, "Tests" maps every scenario to its test. Briefs: `briefs/task-1.md` to `briefs/task-4.md`.

Gates, from the worktree root, Node 22.12+ (D11), prefix `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`, after `test -d node_modules || npm ci`:
- `npm run build --workspace packages/ui`
- `npm run lint --workspace apps/web`
- `npm run typecheck --workspace apps/web`
- `npm run test --workspace apps/web -- --run`
- `npm run build --workspace apps/web`
- `git status` clean after the build
- `openspec validate web-rider-tracking --strict`

No Playwright and no docker by a worker: the manager runs `make e2e` (one at a time, D35). Commit as the repo's configured author, no trailers.

## 1. Rider client and tracking card

Scope: `apps/web/src/api.ts`, `apps/web/src/orders.ts`, `apps/web/src/orders.test.ts`, `apps/web/src/order-parts.tsx`, `apps/web/src/order-tracking.tsx`, `apps/web/src/order-tracking.test.tsx`.
Scenarios: Customer order rider card › the four Vitest scenarios; Customer rider last seen › both; Customer order rider read › both.
Failing tests: `src/orders.test.ts` "last seen wording", "rider read follows the status"; `src/order-tracking.test.tsx` "rider on the way with a position", "rider without a position", "no rider card before a rider", "delivered order names the rider from the rider read", "last seen kept current", "failed rider read keeps the card".

- [x] 1.1 The tests committed (`test: rider card on the tracking page`); lint green; Vitest shows exactly the eight new tests red
- [ ] 1.2 Decisions 1 to 4 (`feat: rider card on the tracking page`); all gates green

## 2. Rider names in the history, countdown from the order

Scope: `apps/web/src/order-tracking.tsx`, `apps/web/src/order-tracking.test.tsx`.
Scenarios: Customer status history names the rider › Rider events name the rider; Customer order countdown › Countdown uses the order's promise, No countdown once finished.
Failing tests (`src/order-tracking.test.tsx`): "rider events name the rider", "countdown uses the order's promise", "no countdown once finished" (changed).

- [ ] 2.1 The tests committed (`test: rider names in the history and the order's own promise`); lint and typecheck green; exactly those three red
- [ ] 2.2 Decisions 5 and 6 (`feat: rider names in the history and the order's own promise`); all gates green

## 3. ui swaps: ChoiceGroup at checkout, ImageTile everywhere

Scope: `apps/web/src/checkout.tsx`, `apps/web/src/checkout.test.tsx`, `apps/web/src/product-card.tsx`, `apps/web/src/order-parts.tsx`, `apps/web/src/cart-drawer.tsx`, `apps/web/src/routes/index.tsx`, `apps/web/src/routes/p.$slug.tsx`, `apps/web/e2e/checkout.spec.ts`, `apps/web/e2e/flows.spec.ts`, `apps/web/e2e/orders.spec.ts` (the phone test's address locator only).
Scenarios: Customer checkout address choice › Default address chosen, Another address chosen, Address added at checkout.
Failing tests (`src/checkout.test.tsx`): "default address chosen", "another address chosen", "address not served", "choosing another address clears the refusal alert", "the address choice is named by its visible text" (all changed to radios). The `ImageTile` swap has no failing test: it changes no behaviour (design Decision 7); the suite is green before and after it.

- [ ] 3.1 The tests and e2e locators committed (`test: checkout address choice is a radio group`); lint and typecheck green; exactly those five red
- [ ] 3.2 Decision 7, checkout part (`feat: checkout address choice from ui's ChoiceGroup`); all gates green
- [ ] 3.3 Decision 7, `ImageTile` part (`refactor: ImageTile from @shopperstop/ui`); all gates green, no test changed

## 4. e2e against core and rider

Scope: `apps/web/vite.config.ts`, `apps/web/playwright.config.ts`, `apps/web/e2e/global-setup.ts`, `apps/web/e2e/smoke.spec.ts`, `apps/web/e2e/orders.spec.ts`.
Scenarios: Customer order rider card › Seeded delivered order against core and rider, Rider picked up and located against core and rider; Customer site reaches core through a same-origin proxy › Web preview proxies to rider; Customer site end-to-end suite with axe (rider started, both seeds reset).
Failing tests: `e2e/smoke.spec.ts` "web preview proxies to rider"; `e2e/orders.spec.ts` "seeded delivered order against core and rider", "rider picked up and located against core and rider". Red and green are shown by the manager's `make e2e`, not by the worker.

- [ ] 4.1 The e2e tests committed (`test: rider card against core and rider`); lint and typecheck green
- [ ] 4.2 Decision 8 (`feat: start and proxy the rider service for the web suite`); all gates green

## Workflow follow-up
- [ ] Team lead runs `/opsx:verify web-rider-tracking` after 4.2 lands and the manager's `make e2e` is green.
- Area manager archives the change by PR after the feature PR merges.
