# web-P2-L6 - web-keep-data-on-refetch-error: keep the showing page when a background refetch fails (team lead)
Status: started
## Doing
Change proposed and validated 2026-10-13; one worker task ready to launch (tasks.md, task 1). Next for this lane: answer worker questions, then `/opsx:verify` after 1.2 lands.
## Found
- Change: `openspec/changes/web-keep-data-on-refetch-error/` (proposal; `web-app` delta: 1 ADDED requirement "Customer pages keep data when a refetch fails", 8 scenarios; design with the audit table, the pattern, the scenario-to-test map; tasks: one). No `docs/design/web-P2-L6.md`: design.md is enough.
- Audit of every query-driven view in `apps/web/src` (design.md, Audit). To change, five views in four files: `StoreGate` (`src/store-gate.tsx`), Home `Categories` and `Picked` (`src/routes/index.tsx`), `CategoryContent` (`src/routes/c.$slug.tsx`), `ProductContent` (`src/routes/p.$slug.tsx`). Already correct: `ProductFeed`, Search `Suggestions`, `ProfileCard`, `AddressesCard`, `AccountLink`, `PincodeButton`, `CartBody`, `CartSheet`/`CartBar`/`CartButton`, `ReplacedNotice`, `useCart`/`useCartQuantity`. The imperative `fetchQuery` reads in `src/store-change.tsx` and `src/cart.ts` are not views and stay ("a failed read is unknown", web-cart).
- The pattern is `if (data === undefined) return error ? alert : skeleton`. Not `error && !data`: `useServiceability` and `useProduct` answer `null` (not serviceable, unknown product), and a failed refetch must keep those notices too. No shared helper (design Decision 2).
- Test recipe, no HTTP mock, checked with a throwaway probe on 34b35ac (not committed): `queryClient.setQueryData(key, data, { updatedAt: Date.now() - 61_000 })` makes the answer older than the 60 s `staleTime`, so mounting the view refetches by itself and the refetch fails under jsdom (`TypeError: Failed to parse URL from /api/core/v1/...`); wait for `getQueryState(key)` to be `{ status: 'error', fetchStatus: 'idle' }`, then assert. On main the six fix tests are red (the alert replaces the content) and the four pins are green. The probe also showed the account profile, the address list and the product list keeping their data.
- Gap in the brief's assumption: the "nothing held still alerts" half had Vitest tests only for the gate ("store lookup fails") and the drawer ("empty, loading and failed cart"). Home's categories and picks, `/c/$slug` and `/p/$slug` had none; the task adds three pins, since the fix reorders exactly those branches.
- Ceilings (design Decisions 4, 5): old data shows with no hint that the refresh failed; a store that closed while core was unreachable still shows as open until a lookup succeeds. Nothing can be ordered without core.
- Archive rehearsed on a scratch copy of `openspec/`: `openspec archive` adds 1 requirement to `web-app` (38 in all), `openspec validate --all --strict` passes there (13 of 13); the merged requirement text is 446 characters (limit 500). On the branch: `openspec validate web-keep-data-on-refetch-error --strict` valid, `--all --strict` 14 of 14.
- The branch is at 34b35ac; origin/main has moved on by two plan-only commits (#131, #132). No conflict expected; the manager rebases when it lands.
- No e2e added (design Decision 7). The worker does not run Playwright.
## Requests
- to admin (through the web manager, information only): `apps/admin` may order `error` before `data` the same way; this lane did not read it. The pattern and the test recipe are in this change's design.md.
## Blockers
None.
