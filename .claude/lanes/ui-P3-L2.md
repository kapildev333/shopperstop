# ui-P3-L2 - rider API types, OpenSpec change ui-rider-api-types
Status: done, acceptance passed on 98b3f31
## Doing
Acceptance (`/opsx:verify` by hand) on 98b3f31: pass.
## Found
- `openspec/changes/ui-rider-api-types/`: MODIFIED "Generated API types" on `design-system` (five scenarios), one task (ui-P3-L2-T1), both checkboxes ticked.
- Scenario coverage, `npm run test --workspace packages/ui -- src/api`: 5/5 passed, one test per scenario: `generated core types match the contract`, `generated rider types match the contract`, `gen:api skips an absent rider contract`, `response types are usable by name`, `rider response types are usable by name` (the two type scenarios also hold under `npm run typecheck --workspace packages/ui`, exit 0). `packages/ui` lint exit 0.
- Test first: 0a3a860 `test:` (only `api.test.ts`, the `core.test.ts` removal and the worker log), then 9fd25fa `feat:` (`package.json`, `rider.d.ts`), then docs commits 96e19a8 (ticks) and 98b3f31 (gate evidence).
- Nothing extra: `git diff --stat a793f3a..HEAD` touches only `packages/ui/package.json`, `packages/ui/src/api/{api.test.ts,core.test.ts,rider.d.ts}`, `tasks.md` and `.claude/lanes/ui-P3-L2-T1.md`.
- `make gen` writes both files, then `git status --porcelain` is empty. `openspec validate --all --strict`: 16 passed, 0 failed.
- Rebase note: main moved past 90a6a96 (core-P3-L2, #215) with `services/core/openapi.json` and `core.d.ts` changed together; this branch does not touch `core.d.ts`, so the rebase is clean and the core stale test still holds. `services/rider/openapi.json` is unchanged on main since 90a6a96, so `rider.d.ts` is current.
- `gen:api` copies (core first, unconditional; rider only when present) are in `packages/ui/package.json`; ceiling: one `if` per later service, which turns into a small script once a third contract arrives.
## Requests
- to rider (via the area plan, D19 extended): once this is on main, a rider lane that changes `services/rider/openapi.json` runs `make gen` and commits the regenerated `packages/ui/src/api/rider.d.ts` in the same PR; the test `generated rider types match the contract` fails `make test-web` otherwise. Apps import rider types from `@shopperstop/ui/api/rider`.
## Blockers
