## 1. Generated API types (ui-P1-L2-T1)

Scope: `packages/ui/package.json`, `packages/ui/src/api/**`, root `package-lock.json` (mechanical). Scenarios: "Stale generated types fail the gate", "Response types are usable by name". Starts from `packages/ui/src/api/core.test.ts`: `generated types match the contract` and `response types are usable by name`.

- [x] 1.1 `chore:` pin `typescript` 5.9.3 and add `openapi-typescript` 7.13.0 (exact) to `packages/ui` devDependencies; existing gates green
- [x] 1.2 `test:` `src/api/core.test.ts` with both tests; red (`src/api/core.d.ts` and the `./api` export do not exist)
- [x] 1.3 `feat:` `gen:api` script, `./api` types export, generated `src/api/core.d.ts`; all gates green and `npm run gen:api --workspace packages/ui` leaves a clean tree
