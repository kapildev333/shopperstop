# core-P4-L1 - store product filters (inStock, sort) and store city (OpenSpec change core-catalog-filters-store-city)
Status: started
## Doing
2026-10-16: change `core-catalog-filters-store-city` written and validated (`--strict`; `--all --strict` 20 passed); two worker briefs (`core-P4-L1-t1.md`, `core-P4-L1-t2.md`); waiting for the manager to launch task 1.
## Found
- Change `openspec/changes/core-catalog-filters-store-city/`: deltas `catalog` (MODIFIED "Store products are listed and searched"; ADDED "Store products can be limited to those in stock", "Store products can be sorted by price"), `serviceability` (MODIFIED "Public store view"), `admin-stores` (MODIFIED list/read, create, validated, change, demo stores). Every requirement body under 500 characters. design.md carries every change as a verbatim diff (`git apply --check` clean on eadd7da) plus two `openapi.json` scripts.
- Spike on a copy of `services/core` outside the worktree: every package green under `-race -count=1` with the design applied (seed's `TestSummaryMatchesSeed` needs `docs/postman/`, green only in the repo). openapi scripts and `core.d.ts` regen spiked in the worktree and reverted (tree clean before the commit); `node_modules` installed in the worktree by `npm ci` (gitignored).
- `city` is omitted when empty (`json:"city,omitempty"`), not always present as the brief proposed: CLAUDE.md "optional = omitted", core's optional text all works that way, and a required `city` would break typed response fixtures in web (`test-data.ts`), admin (`fake-core.ts`), rider app (`fake-api.ts`). Escalated in the report for the manager to confirm.
- openapi-typescript turns a property with `default` into a required member: `StoreCreate.city` must have no `default` (spiked: it broke admin's request body type).
- Cross-area break (spiked): `apps/admin/src/store-form.tsx:10` `type Field = keyof StoreCreate` with `Record<Field, string>` literals fails TS2741 once `StoreCreate.city` exists. Fix `type Field = Exclude<keyof StoreCreate, 'city'>` typechecks against main and the new `core.d.ts`; `store-form.test.tsx` 8/8 green with it. Web, rider, mobile, ui typecheck unchanged.
- The rider service reads no store JSON from core today (only `/admin/stores/{id}/orders` and order routes); nothing to change there.
## Requests
- to admin (through the core area plan and the orchestrator, before task 2 merges): `apps/admin/src/store-form.tsx` line 10: `type Field = keyof StoreCreate` -> `type Field = Exclude<keyof StoreCreate, 'city'>`.
- to mobile (information, once merged): `GET /stores/{id}/products?inStock=true&sort=price_asc|price_desc`; `Store.city` optional (omitted when the store has none; both demo stores `Bengaluru`).
## Blockers
None.
