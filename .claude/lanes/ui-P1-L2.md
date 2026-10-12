# ui-P1-L2 - generated API types, OpenSpec change ui-api-types
Status: done
## Doing
Acceptance passed on ca46622; design.md and proposal amended to match the landing.
## Found
- Change `openspec/changes/ui-api-types/`: one ADDED requirement on `design-system` ("Generated API types"), two scenarios, one task (T1).
- TypeScript in `packages/ui` moves 6.0.3 -> 5.9.3 (PLAN.md D18): `openapi-typescript` 7.13.0 declares peer `typescript ^5.x`; with TS 6 installed npm fails with ERESOLVE (measured). On 5.9.3 install resolves cleanly and all existing gates stay green (spike on a scratch copy of 6ae9c6b, Node 22.23.3, npm 10.9.9).
- `./api` export is types only, pointing at `./src/api/core.d.ts` (tsc does not emit `.d.ts` under src). Apps add `openapi-fetch` themselves: `createClient<paths>({ baseUrl: '/api/core/v1' })`; generated paths are relative to the server URL.
- CLI output is deterministic; stdout without `-o` equals the file, so the freshness test needs no temp file. Resolve the CLI through `openapi-typescript/package.json` (the `./*.js` export maps `bin/cli.js` to a nonexistent `.mjs`).
- `expectTypeOf` is checked only by `npm run typecheck`, not by vitest at runtime.
- Resolved: D18 (TypeScript 5.9.3 in packages/ui), D19 (a core lane that changes openapi.json regenerates `packages/ui/src/api/core.d.ts` in the same PR, never hand-edited).
- Acceptance (opsx:verify by hand, 2026-10-12, Node 22.23.3): both delta scenarios have a passing test of the same name in `src/api/core.test.ts` ("Stale generated types fail the gate" -> `generated types match the contract`; "Response types are usable by name" -> same name, enforced by `npm run typecheck`). Task 1 (1.1 to 1.3) ticked. Commit order chore 3d09857, test 5e9d1d4 (test file only), feat ca46622. Gates re-run: lint, typecheck, build clean; 25 files, 53 tests passed; `gen:api` leaves `git status --porcelain` empty; `dist/` has no `api/` (export points at src, as designed). `openspec validate ui-api-types --strict` valid; `--all --strict` 4 passed, 0 failed. Scope: `git diff --stat origin/main...HEAD` touches only `packages/ui/{package.json,src/api/**}`, root `package-lock.json`, `openspec/changes/ui-api-types/**`, `.claude/lanes/ui-P1-L2*.md`. Nothing extra.
- design.md amended: explicit vitest imports (`expect`, `expectTypeOf`, `it`), paths from `import.meta.url` via `new URL`, D19 in Risks; proposal cites D19.
## Requests
## Blockers
