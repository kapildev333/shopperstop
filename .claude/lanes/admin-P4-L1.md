# admin-P4-L1 - store city on the admin store form and stores table (OpenSpec change admin-store-city)
Status: started
## Doing
2026-10-16: change `admin-store-city` written and validated (`--strict`); two worker briefs in the team lead's report (T1 form + e2e line, T2 table column; disjoint files, can run in parallel). Waiting for workers.
## Found
- Spiked and reverted: `Field = keyof StoreCreate` with `city` in `messages`/`initial`/body and `changed` comparing `(store[key] ?? '') !== value` passes typecheck and lint; of the existing 8 `store-form.test.tsx` tests only "create a store and open it" changes (the body gains `city`).
- Vitest in a fresh worktree needs `npm run build --workspace packages/ui` first (else `@shopperstop/ui` fails to resolve); `make test-web` does it.
- The brief's "dialogs" are the `/stores/new` and `/stores/{id}` pages; the table has no address column, so "City" sits after "Name" (design.md decision 4).
- core-P4-L1's request to admin (#270 exclusion) is the line this change removes.
## Requests
None.
## Blockers
None.
