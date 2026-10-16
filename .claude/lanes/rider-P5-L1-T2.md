# rider-P5-L1-T2 - rider app cash badge and amount line (task 2 of rider-collect-cash)
Status: red committed (test commit); code next

## Brief
- LANE-ID: rider-P5-L1 (task T2). Area: `rider`.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/rider-P5-L1`. Branch: `lane/rider-P5-L1-collect-cash`. Work and commit only there; never push. Commit as `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no attribution or co-author trailers. Commit with a pathspec, never amend. Never run docker or touch containers; `make e2e` is the manager's, not yours.
- Change: `openspec/changes/rider-collect-cash/`, task 2 (`tasks.md` 2.1, 2.2). Read `design.md` Decisions 3 to 5, then "Code".
- Needs T1's commits on the branch (`packages/ui/src/api/rider.d.ts` with `paymentStatus` and `ReadyOrder.paymentMethod`); check with `grep -c paymentStatus packages/ui/src/api/rider.d.ts` (non-zero).
- Scenarios (rider-app): "Cash orders marked"; "Cash on delivery", "Paid online", "Awaiting payment", "Delivered shows no collection"; "Customer to rider to delivered" (the e2e assertions, run by the manager).
- Scope paths (nothing else): `apps/rider/src/ready.tsx`, `apps/rider/src/delivery.tsx`, `apps/rider/src/ready.test.tsx`, `apps/rider/src/delivery.test.tsx`, `apps/rider/src/fake-api.ts`, `apps/rider/e2e/flow.spec.ts`, `openspec/changes/rider-collect-cash/tasks.md` (ticks 2.1, 2.2), this file.
- Failing tests to start from: `apps/rider/src/delivery.test.tsx` › `assigned delivery shown`, `cash on delivery`, `paid online`, `awaiting payment`; `apps/rider/src/ready.test.tsx` › `cash orders marked`.

## Steps and commits
0. Setup, from the worktree root: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH` (Node 22.11 breaks Vitest with ERR_REQUIRE_ESM); `test -d node_modules || npm ci`; `npm run build --workspace packages/ui`.
1. Copy design.md "Task 2: tests" to a scratch file outside the repo; `git apply` it. `npm run test --workspace apps/rider -- --run` must show exactly the 5 failures above (5 failed / 59 passed). Paste the summary under "Red run". Commit `test: rider cash badge and payment line` (the four test-side files and this file).
2. Apply "Task 2: code" the same way. Gates: `npm run lint --workspace apps/rider`, `npm run typecheck --workspace apps/rider`, `npm run test --workspace apps/rider -- --run` (64 passed), `npm run build --workspace apps/rider`, then `make test-web`; all exit 0. Tick 2.1 and 2.2 in tasks.md. Commit `feat: rider marks cash orders and shows collect, paid online or awaiting payment` (`ready.tsx`, `delivery.tsx`, tasks.md, this file).

If a diff does not apply, the red/green counts differ or a gate fails, stop and write it under Blockers; do not improvise. Never edit `packages/ui/`, `services/`, other apps or the lane log `rider-P5-L1.md`.

## Red run
`npm run test --workspace apps/rider -- --run`: 2 files failed, **5 failed / 59 passed (64)**. Failing: `ready.test.tsx` cash orders marked; `delivery.test.tsx` assigned delivery shown, cash on delivery, paid online, awaiting payment (`Unable to find` the `Collect ₹339 in cash` / `Paid online` / `Awaiting payment` text; the cash badge `getByText('Cash')` misses on the ready card). `delivered cod/online shows no payment line` pass already (no line is the current behaviour).
## Green run
## Gates
## Found
## Blockers
