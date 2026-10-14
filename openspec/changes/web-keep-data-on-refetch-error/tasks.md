# Tasks

One task, one worker, on branch `lane/web-P2-L6-keep-data-on-refetch-error` in `.worktrees/web-P2-L6`. Read `design.md` first: it fixes the pattern, the files, the two test helpers and the test names.

Gates, from the worktree root, Node 22.12+ (D11), prefix `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`: `npm run build --workspace packages/ui`, `npm run lint --workspace apps/web`, `npm run typecheck --workspace apps/web`, `npm run test --workspace apps/web -- --run`, `npm run build --workspace apps/web`, `git status` clean after the build, `openspec validate web-keep-data-on-refetch-error --strict`. No Playwright by the worker. Commit as the repo's configured author, no trailers.

## 1. A failed refetch keeps the showing page

Scope: `apps/web/src/store-gate.tsx`, `src/routes/index.tsx`, `src/routes/c.$slug.tsx`, `src/routes/p.$slug.tsx`, `src/test-data.ts` (`seedStale`, `refetchFailed`), `src/store-gate.test.tsx`, `src/home.test.tsx`, `src/category.test.tsx`, `src/product.test.tsx`, this file's checkboxes. Not in scope: `src/product-feed.tsx`, `src/catalog.ts`, `src/api.ts`, `src/cart*.ts*`, `src/routes/account.tsx`, `src/routes/search.tsx`, `packages/ui`, `e2e/`.
Scenarios: Customer pages keep data when a refetch fails › all eight.
Failing tests (red on arrival, each on "no alert"): `src/store-gate.test.tsx` › "failed refetch keeps the store", "failed refetch keeps the not serviceable notice"; `src/home.test.tsx` › "failed refetch keeps home"; `src/category.test.tsx` › "failed refetch keeps the category page"; `src/product.test.tsx` › "failed refetch keeps the product page", "failed refetch keeps product not found".
Pins, green on arrival (say so in the commit body): `src/category.test.tsx` › "failed refetch keeps the product list", "category alerts with nothing held"; `src/home.test.tsx` › "home alerts with nothing held"; `src/product.test.tsx` › "product alerts with nothing held".
Easy to get wrong:
- The check is `data === undefined`, never `!data` and never `error && !data`: `null` is the answer for a pincode no store delivers to and for an unknown product, and its notice must stay.
- Every refetch test awaits `refetchFailed(key)` before asserting; without it the test passes on the unfixed code.
- Only the read under test is seeded with `seedStale`; everything else the page needs is seeded with plain `queryClient.setQueryData`, or its own failed read adds an alert.
- "No alert" is `expect(screen.queryAllByRole('alert')).toEqual([])`.
- No HTTP mock, no `vi.mock`, no fake timers, no new helper or component in app code, no copy or class change. `isPending` goes from `store-gate.tsx` and `p.$slug.tsx` once nothing reads it (lint).
- The existing tests stay untouched and green, "store lookup fails" among them.

- [x] 1.1 Tests and the two helpers committed, six red and four pins green (`test: a failed refetch keeps the showing page`)
- [x] 1.2 The four views (`fix: a failed refetch keeps the showing page`); all gates green

## Workflow follow-up
- [ ] Team lead runs `/opsx:verify web-keep-data-on-refetch-error` after 1.2 lands.
- Area manager archives the change by PR after the fix PR merges.
