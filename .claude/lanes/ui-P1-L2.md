# ui-P1-L2 - generated API types, OpenSpec change ui-api-types
Status: started
## Doing
Change written and validated; briefs handed to the ui manager. Waiting for T1 to land, then acceptance (/opsx:verify).
## Found
- Change `openspec/changes/ui-api-types/`: one ADDED requirement on `design-system` ("Generated API types"), two scenarios, one task (T1).
- TypeScript in `packages/ui` moves 6.0.3 -> 5.9.3 (PLAN.md D18): `openapi-typescript` 7.13.0 declares peer `typescript ^5.x`; with TS 6 installed npm fails with ERESOLVE (measured). On 5.9.3 install resolves cleanly and all existing gates stay green (spike on a scratch copy of 6ae9c6b, Node 22.23.3, npm 10.9.9).
- `./api` export is types only, pointing at `./src/api/core.d.ts` (tsc does not emit `.d.ts` under src). Apps add `openapi-fetch` themselves: `createClient<paths>({ baseUrl: '/api/core/v1' })`; generated paths are relative to the server URL.
- CLI output is deterministic; stdout without `-o` equals the file, so the freshness test needs no temp file. Resolve the CLI through `openapi-typescript/package.json` (the `./*.js` export maps `bin/cli.js` to a nonexistent `.mjs`).
- `expectTypeOf` is checked only by `npm run typecheck`, not by vitest at runtime.
## Requests
- to orchestrator (via ui manager): decide who regenerates `packages/ui/src/api/core.d.ts` when core changes `openapi.json` (the ui test fails ci's `web` job otherwise).
## Blockers
