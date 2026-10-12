# ui-P1-L1 - packages/ui (@shopperstop/ui), OpenSpec change ui-packages-ui
Status: blocked
## Doing
Change proposed and validated (`openspec validate ui-packages-ui --strict` valid; `--all --strict` 3 passed); waiting for the Node upgrade and the typescript-eslint decision before worker task 1.
## Found
- Change `openspec/changes/ui-packages-ui/`: ADDED requirements on `design-system` only, names distinct from the four seeded ones; 8 tasks (1 alone, 2 to 7 parallel, 8 after 2).
- `src/index.ts` is written once by task 1 with every `export *` line; each component file starts as an `export {}` placeholder its task replaces. Parallel branches never share a file except their own `tasks.md` checkbox lines.
- Vite 8, Vitest 5, jsdom 27+ need Node >= 22.12. On Node 22.11.0 npm skips Rolldown's native binding (engine check) and jsdom fails with `ERR_REQUIRE_ESM`. Scratch spike green on Node 22.23.3.
- TypeScript pinned 6.0.3 (TS 7 breaks typescript-eslint peer `<6.1`); ESLint pinned 9.39.5 (jsx-a11y 6.10.2 declares only `^9`).
- Measured contrast: accent/accent-soft 4.36, success/success-soft 4.36, danger/danger-soft 4.01, ink-muted/canvas 4.47, line-strong/surface 1.60. Components use `ink` text on soft surfaces; `line-strong` escalated.
- Consumption contract for web/admin: `index.css` = `@import "tailwindcss"; @import "@shopperstop/ui/tokens.css";`; `@shopperstop/ui` must be built before app typecheck/test/build; matcher from `@shopperstop/ui/testing`.
## Requests
- to owner/orchestrator: Node >= 22.12 on this machine; PLAN.md decision on `typescript-eslint` 8.71.2; palette decision on `line-strong` (suggest #868C94, 3.39:1).
- to platform: raise root `engines.node` to `>=22.12.0`; CI and Makefile build `packages/ui` before app gates.
- to core: `services/core/openapi.json` (unblocks the deferred `api/core.d.ts`).
## Blockers
- Node 22.11.0 locally: no worker gate can run until Node >= 22.12 is on PATH.
