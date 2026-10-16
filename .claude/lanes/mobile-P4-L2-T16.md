# mobile-P4-L2-T16 - mobile-serviceability-catalog task 16: e2e catalog scenarios against core
Status: blocked
## Doing
Stopped at 16.3: make e2e run from the worktree root (exit 2): admin 15 passed, mobile 12 passed and 3 failed (orders.spec.ts), rider 7 passed, web 45 passed. Reported to the manager; no edit to orders.spec.ts.
## Found
- Commits: 854831d `test:` catalog e2e scenarios (red: notices against core failed on axe color-contrast, #6b7280 on #f5f6f8 at 4.47:1); 0285a4f `fix:` store notices on surface; fe4e266 `fix:` comment without the canvas hex (no-literal-colors guard caught it).
- `e2e/catalog.spec.ts`: 8 scenarios (pincode resolves, notices, home, browse a category, search and load more, product pages, category filters, store change). All 8 green on the web export against core (`npm run e2e --workspace apps/mobile -- --grep catalog`).
- `e2e/accounts.spec.ts` heading line was already `/shopperstop/i` on this branch (no change needed here); its scenario passes.
- Gates: lint, typecheck, build (apps/mobile), `openspec validate --all --strict` (20 passed) all exit 0; full Jest 68 suites / 235 tests green after fe4e266 (the 0285a4f comment broke `no-literal-colors` until fe4e266).
- `make e2e` from the worktree root (run 2026-10-16, log in the scratchpad): admin 15 passed; mobile 12 passed, 3 failed; rider 7 passed; web 45 passed; make exit 2 on the mobile failure.
- Playwright output for the full mobile suite (`npm run e2e --workspace apps/mobile`): 12 passed, 3 failed; the 3 are `e2e/orders.spec.ts` (History, Tracking, Cancel): the first-visit pincode sheet (L2 task 11, spec "First visit opens the pincode sheet") covers the tab bar, so the Orders tab cannot be clicked. A probe that presets `shopperstop:pincode` = 560034 in orders.spec.ts's `signedIn` helper made all 3 green; the probe was reverted, not committed.
## Requests
- to mobile manager / mobile-P4-L4a: `apps/mobile/e2e/orders.spec.ts` `signedIn()` must also set `localStorage['shopperstop:pincode'] = '560034'` (the first-visit sheet of L2 otherwise covers the tabs). The file is L4a's, outside task 16's scope, so this worker did not edit it. Once it lands on this branch (or in the PR), `make e2e` should exit 0.
## Blockers
- `make e2e` cannot exit 0 until the orders.spec.ts change above is on this branch; tasks.md 16.3 stays open.
