# ui-P1-L1 - packages/ui (@shopperstop/ui), OpenSpec change ui-packages-ui
Status: started
## Doing
Change proposed and validated (`openspec validate ui-packages-ui --strict` valid; `--all --strict` 3 passed); amended for PLAN.md D10 to D12; ready for worker task 1.
## Found
- Change `openspec/changes/ui-packages-ui/`: ADDED requirements on `design-system` only, names distinct from the four seeded ones; 8 tasks (1 alone, 2 to 7 parallel, 8 after 2).
- `src/index.ts` is written once by task 1 with every `export *` line; each component file starts as an `export {}` placeholder its task replaces. Parallel branches never share a file except their own `tasks.md` checkbox lines.
- Vite 8, Vitest 5, jsdom 27+ need Node >= 22.12. On Node 22.11.0 npm skips Rolldown's native binding (engine check) and jsdom fails with `ERR_REQUIRE_ESM`. Scratch spike green on Node 22.23.3.
- TypeScript pinned 6.0.3 (TS 7 breaks typescript-eslint peer `<6.1`); ESLint pinned 9.39.5 (jsx-a11y 6.10.2 declares only `^9`).
- Measured contrast: accent/accent-soft 4.36, success/success-soft 4.36, danger/danger-soft 4.01, ink-muted/canvas 4.47, line-strong/surface 1.60. Components use `ink` text on soft surfaces; `line-strong` escalated.
- Consumption contract for web/admin: `index.css` = `@import "tailwindcss"; @import "@shopperstop/ui/tokens.css";`; `@shopperstop/ui` must be built before app typecheck/test/build; matcher from `@shopperstop/ui/testing`.
- Resolved: D10 (typescript-eslint and implied dev tooling approved), D11 (Node >= 22.12; lanes use `~/.local/node-v22.23.3/bin` on PATH), D12 (`line-strong` #868C94). Spec delta now says `line-strong` is #868C94; the contrast test also asserts line-strong on surface >= 3.
- Task 2: `buttonVariantClass` stays exported (public, like `buttonClass`; no narrowing). `ref` is typed explicitly as a prop and `ButtonLink` destructures `children` for jsx-a11y; both accepted.
## Requests
- to platform: CI and Makefile build `packages/ui` before app gates.
- to core: `services/core/openapi.json` (unblocks the deferred `api/core.d.ts`).
## Blockers
