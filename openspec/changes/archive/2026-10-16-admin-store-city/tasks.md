## 1. Store form city (admin-P4-L1-T1)

Scope: `apps/admin/src/store-form.tsx`, `apps/admin/src/store-form.test.tsx`, `apps/admin/e2e/stores.spec.ts`. Scenarios: "Store create" > "Create a store"; "Store change" > "Change sends only the changed fields", "Set and clear the city", "Demo store city from core" (e2e); "Store form errors" > "City error from core".

- [x] 1.1 `test:` in `store-form.test.tsx`, update "create a store and open it" (type City `Bengaluru`, expect `city: 'Bengaluru'` in the body), assert "City" is empty in "edit sends only the changed fields", add "edit sets and clears the city" and "a city error from core is shown on its field"; extend `e2e/stores.spec.ts` with one line; see them fail
- [x] 1.2 `feat:` `store-form.tsx`: `Field = keyof StoreCreate`, `city` in `messages`, `initial`, the body, the "City" field after "Address" with hint "Optional.", `changed` compares `(store[key] ?? '') !== value`

## 2. Stores table city column (admin-P4-L1-T2)

Scope: `apps/admin/src/routes/_staff/_admin/stores/index.tsx`, `apps/admin/src/stores.test.tsx`. Scenario: "Stores table" > "Stores listed".

- [x] 2.1 `test:` in `stores.test.tsx` "stores table lists every store": Koramangala with `city: 'Bengaluru'`, a "City" column header, its row shows `Bengaluru`; see it fail
- [x] 2.2 `feat:` a `{ key: 'city', header: 'City', cell: (store) => store.city }` column after "Name"
