## 1. Rider API types (ui-P3-L2-T1)

Scope: `packages/ui/package.json`, `packages/ui/src/api/**`. Scenarios: "Stale generated types fail the gate", "Stale generated rider types fail the gate", "Response types are usable by name", "Rider response types are usable by name", "An absent rider contract is skipped". Starts from `packages/ui/src/api/api.test.ts`: `generated rider types match the contract`, `rider response types are usable by name`, `gen:api skips an absent rider contract`.

- [ ] 1.1 `test:` `git mv src/api/core.test.ts src/api/api.test.ts`; stale check over core and rider, rider type test, absent-contract test; red (no `rider.d.ts`, no `./api/rider` export, no skip line)
- [ ] 1.2 `feat:` `gen:api` with the rider branch, `./api/rider` types export, generated `src/api/rider.d.ts`; all gates green and `make gen` leaves a clean tree
