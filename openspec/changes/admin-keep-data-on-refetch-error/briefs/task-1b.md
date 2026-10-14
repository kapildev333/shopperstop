# Worker brief: admin-P2-L7 task 1b, the product page alerts only for a read that failed with nothing held

- LANE-ID: admin-P2-L7 (worker log: `.claude/lanes/admin-P2-L7-T1b.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L7` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L7-keep-data-on-refetch-error` (commit here; never push)
- OpenSpec change: `admin-keep-data-on-refetch-error`, task 1b in `openspec/changes/admin-keep-data-on-refetch-error/tasks.md`
- Starts after: task 1 landed and reviewed (`.claude/lanes/admin-P2-L7-R1.md`, finding 1)

## Read first
1. `openspec/changes/admin-keep-data-on-refetch-error/tasks.md`, the header and section 1b.
2. `openspec/changes/admin-keep-data-on-refetch-error/design.md`, section "Task 1b". The test and the edit are there in full; copy them byte for byte. Do not redesign, rename, reformat or "improve" them.

## Scope paths (touch nothing else)
- `apps/admin/src/refetch.test.tsx` (append the APPEND block after one blank line at the end; change nothing above it)
- `apps/admin/src/routes/_staff/_admin/products/$productId.tsx` (EDIT 13, one replacement)
- `openspec/changes/admin-keep-data-on-refetch-error/tasks.md` (tick only 1b.1 and 1b.2, with the Edit tool)
- `.claude/lanes/admin-P2-L7-T1b.md` (your log)

Do NOT edit `stores/$storeId.tsx`, `products/new.tsx`, `stock.tsx`, `service-areas.tsx` or `refetch-notice.tsx`: they were checked and do not have this fault.

## Scenario covered
Admin pages keep data when a refetch fails › Product opened while cached categories fail to refresh.

## Failing test to start from
`apps/admin/src/refetch.test.tsx` › "a product opened while its read is still out shows the skeleton, not the alert, when the cached categories fail to refresh". Red on arrival: `Unable to find an accessible element with the role "status" and name "Loading"`.

## Steps, in order
Every command from the worktree root with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` in front.

0. `git status --short` is empty; `npm run build --workspace packages/ui`; `npm run test --workspace apps/admin -- --run` prints `Tests  179 passed (179)`. If not, stop and report.
1. Append the APPEND block to `apps/admin/src/refetch.test.tsx`.
2. `npm run test --workspace apps/admin -- --run` prints `Tests  1 failed | 179 passed (180)`, the one named above. `npm run lint --workspace apps/admin` and `npm run typecheck --workspace apps/admin` pass. Paste the summary into your lane log.
3. Tick 1b.1 (Edit tool). Commit: `test: a product still loading shows the skeleton when cached categories fail to refresh`
4. Apply EDIT 13: the "Replace" line occurs exactly once in the file; if not, stop and report.
5. `npm run test --workspace apps/admin -- --run` prints `Tests  180 passed (180)`.
6. Gates: `make test-web` exits 0 with ui `54 passed`, admin `180 passed`, web `101 passed`; `git status --short` lists only scope files; `openspec validate admin-keep-data-on-refetch-error --type change --strict` is valid. Paste the summaries into your lane log.
7. Tick 1b.2 (Edit tool). Commit: `fix: the product page alerts only for a read that failed with nothing held`
8. Set your lane log to `Status: done` and report the two hashes, the summaries of steps 2 and 5, the `make test-web` counts, anything that differed.

## Rules
- Test first: the `test:` commit exists before the edit of step 4 is made.
- Never amend a commit; no attribution or co-author trailers; commit as the repository's configured author; never push.
- Never run `make e2e`, Playwright, `make db`, `make dev`, `make prod-local` or any docker command.
- No timers in the test; nothing else is added to it. Any count that differs or any open choice: stop and report.
