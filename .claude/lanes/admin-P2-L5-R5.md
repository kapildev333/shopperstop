# admin-P2-L5-R5 - review of task 5 (past-the-end skeleton, dashboard) and the whole lane diff (reviewer)
Status: done

## Verdict
Approve with nits. No blocking finding.

## Gates (run by me, worktree root, Node 22.23.3)
- `make test-web`: exit 0. ui 25 files / 54 tests, admin 25 files / 295 tests, web 26 files / 149 tests. (First run failed in ui typecheck, `Cannot find module 'vitest'`: the worktree's node_modules was being rewritten at that moment; `npm ci` then a re-run was green. Not a code finding.)
- `openspec validate --all --strict`: 15 passed, 0 failed.
- Red-first in a throwaway worktree (removed afterwards): 51fa237 `1 failed | 287 passed (288)`; acfc80e `7 failed | 288 passed (295)`, all seven in `dashboard.test.tsx`. As reported.
- `git status --short` clean after the gates. No e2e, no docker, no touch of :18080/15173/15174.

## Findings
R5-1 NIT, `routes/_staff/index.tsx` Dashboard: a needless fragment `<>...</>` around the empty-or-grid ternary; drop it.
R5-2 NIT, `routes/_staff/index.tsx`: no `refetchInterval`, so an open dashboard changes only on focus/visibility (as the brief says). Counts are "today", so a tab left open all day goes stale until focus. Accept; note for a later polish.
R5-3 NIT, e2e sign-in budget: admin@ signs in about 7 times per run across auth (1), orders (1), catalog (2), stores, stock, staff; core limits 10 per email per hour. Fine with no retries, but one Playwright retry of several specs would near the limit. koramangala@ about 4.
R5-4 NIT, process: tick 5.1 and 5.3 sit in the test commits and 5.2/5.4 in the code commits; fine, order is test, fix, test, feat.

## Checked and correct
- Step A: `empty && page > 1` shows the skeleton in place of the empty state; the alert only when `isError && data === undefined`; a failed last-page fetch drops the placeholder, so the alert appears (no endless skeleton). Test holds the lists twice as designed and looks between.
- Step B: one `region` per store from `GET /admin/dashboard` in core's order; store staff get core's single card (no client filter needed); "Orders today" is the client sum of the seven statuses (spec: "with their sum"); Price for revenue, "1 product"/"N products". Links typed (`/orders` search `{store}`, `/stock` search `{store, lowStock: true}`), accessible names "Orders at X" and "Low stock at X". Skeleton / alert with retry / "No stores yet" / failed refresh keeps cards (root notice, no alert) all match the spec and are tested. Only h2s are store names; `dl` has `dt`/`dd` children directly.
- Scope: only `index.tsx`, `order-history.tsx` and the two test files; no dependency, `routeTree.gen.ts` untouched, tokens and `@shopperstop/ui` components only.
- Whole lane diff vs main (L6 merged): `idle.ts` is lane-owned and not shadowed by L6; `catalog.spec.ts` keeps L6's tests and adds one ordered-product test that checks and cancels the dialog (product stays active); nav and the root RefetchNotice unchanged by this lane; no conflicts found.
- E2E vs core seed (`internal/seed/seed.go`, `catalog.go`): SS-DEMOAAAB/C/D at Koramangala (...0701/2/3) delivered/cancelled/placed; SS-DEMOAAAD has Banana x1 and Pomegranate x3 = 4 items, subtotal 103000 paise (free delivery above 19900) = ₹1,030; placed 10 minutes ago; address Home, pincode 560034; customer Demo Customer +919800000000; accounts koramangala@ staff12345 and admin@ admin12345 exist. The "Low stock" regex `\d+ products` holds (seed puts 1 to 4 on about 1 in 15 products per store, so several). The mutating first test is first in the file and depends on the per-run reset it states. Plausible to pass; not run (no e2e by instruction).
