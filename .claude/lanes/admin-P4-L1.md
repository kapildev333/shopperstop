# admin-P4-L1 - store city on the admin store form and stores table (OpenSpec change admin-store-city)
Status: done
## Doing
2026-10-16: acceptance (opsx:verify) PASS on 856939d. Tasks 4/4 ticked. Commits test-first: T2 23d3c2b then 0dc6fa6; T1 8a9cc3c, 0cac58b (test only) then fcdd60f; merge of origin/main 856939d. Diff against origin/main is only the five `apps/admin` files in design.md plus the change and this log; nothing extra. Scenario to test: Stores listed `stores.test.tsx` "stores table lists every store"; Create a store "create a store and open it"; Change sends only the changed fields "edit sends only the changed fields and confirms"; Set and clear the city "edit sets and clears the city"; City error from core "a city error from core is shown on its field"; unchanged scenarios keep their tests (A second save, Saved change shows in the table, Unknown store, Value the form cannot send, Field error from core, Other save failure); Demo store city from core: `e2e/stores.spec.ts` "admin edits a store and meets the pincode conflict" line `getByLabel('City')` `Bengaluru`, written but not run here (the manager's `make e2e` slot). Re-run here: ui build, admin lint 0, typecheck 0, Vitest 27 files 326 passed; `openspec validate admin-store-city --strict` valid.
## Found
- After merging origin/main the worktree's node_modules was stale (TS2688 vite/client, eslint resolve errors); `npm ci` again fixed it (first attempt exited 190, second clean).
- Spiked and reverted: `Field = keyof StoreCreate` with `city` in `messages`/`initial`/body and `changed` comparing `(store[key] ?? '') !== value` passes typecheck and lint; of the existing 8 `store-form.test.tsx` tests only "create a store and open it" changes (the body gains `city`).
- Vitest in a fresh worktree needs `npm run build --workspace packages/ui` first (else `@shopperstop/ui` fails to resolve); `make test-web` does it.
- The brief's "dialogs" are the `/stores/new` and `/stores/{id}` pages; the table has no address column, so "City" sits after "Name" (design.md decision 4).
- core-P4-L1's request to admin (#270 exclusion) is the line this change removes.
## Requests
None.
## Blockers
None.
