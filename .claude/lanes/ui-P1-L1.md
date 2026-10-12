# ui-P1-L1 - packages/ui (@shopperstop/ui), OpenSpec change ui-packages-ui
Status: done
## Doing
Acceptance passed on `af13647`; design.md amended to match the landing (`docs: design.md matches the landing`).
## Found
- Change `openspec/changes/ui-packages-ui/`: ADDED requirements on `design-system` only, names distinct from the four seeded ones; 8 tasks (1 alone, 2 to 7 parallel, 8 after 2).
- `src/index.ts` is written once by task 1 with every `export *` line; each component file starts as an `export {}` placeholder its task replaces. Parallel branches never share a file except their own `tasks.md` checkbox lines.
- Vite 8, Vitest 5, jsdom 27+ need Node >= 22.12. On Node 22.11.0 npm skips Rolldown's native binding (engine check) and jsdom fails with `ERR_REQUIRE_ESM`. Scratch spike green on Node 22.23.3.
- TypeScript pinned 6.0.3 (TS 7 breaks typescript-eslint peer `<6.1`); ESLint pinned 9.39.5 (jsx-a11y 6.10.2 declares only `^9`).
- Measured contrast: accent/accent-soft 4.36, success/success-soft 4.36, danger/danger-soft 4.01, ink-muted/canvas 4.47, line-strong/surface 1.60. Components use `ink` text on soft surfaces; `line-strong` escalated.
- Consumption contract for web/admin: `index.css` = `@import "tailwindcss"; @import "@shopperstop/ui/tokens.css";`; `@shopperstop/ui` must be built before app typecheck/test/build; matcher from `@shopperstop/ui/testing`.
- Resolved: D10 (typescript-eslint and implied dev tooling approved), D11 (Node >= 22.12; lanes use `~/.local/node-v22.23.3/bin` on PATH), D12 (`line-strong` #868C94). Spec delta now says `line-strong` is #868C94; the contrast test also asserts line-strong on surface >= 3.
- Task 2: `buttonVariantClass` stays exported (public, like `buttonClass`; no narrowing). `ref` is typed explicitly as a prop and `ButtonLink` destructures `children` for jsx-a11y; both accepted.
- Task 7: confirmed, non-hex `$value` leaves (numbers, font families) are skipped (colours only; a token whose Figma value is not hex still surfaces as `missing in figma`); printed hex values are the normalised ones (upper-case, `FF` alpha dropped).
- Acceptance (opsx:verify by hand, 2026-10-12, Node 22.23.3): all 44 delta scenarios in `specs/design-system/spec.md` have a passing test of the same name (case-insensitive diff of scenario titles against `it`/`test` names: no gaps); the six package-owned seed scenarios are covered as tasks.md maps them ("Literal colour fails the gate" by `no literal colours in src` and `each literal kind is matched`; the other five by same-named tests); "Axe on every e2e page" belongs to web and admin. Extra test beyond the scenarios: `input forwards props and ref`. All 8 tasks / 16 checkboxes ticked. Gates re-run: lint, typecheck, build clean; 24 files, 51 tests passed; `openspec validate --all --strict` Totals: 3 passed, 0 failed. Scope: `git diff --stat origin/main...HEAD` touches only `packages/ui/**`, `openspec/changes/ui-packages-ui/**`, root `package-lock.json` and `.claude/lanes/ui-P1-L1*.md` (the two-dot diff also shows main's own later commits; not ours).
- design.md amended: consumption snippet for apps (dependency, `index.css`, body `bg-canvas text-ink`, font via the entry, matcher); `buttonVariantClass` export; `className` on every component; `ComponentPropsWithRef` for Input/Select; FormField child type; Stepper Out of stock classes, no ADD hover (4.36 contrast), inner-button hover; PageHeader inner div; EmptyState `gap-2`; useModal onClose ref and empty-panel Tab; DialogFooter children optional; Sheet title colour inherited.
- Answered T1's request: design.md's app snippet uses `dirname(fileURLToPath(import.meta.url))` (jsdom's `URL` is rejected by `fileURLToPath`).
## Requests
- to platform: CI and Makefile build `packages/ui` before app gates.
- to core: `services/core/openapi.json` (unblocks the deferred `api/core.d.ts`).
## Blockers
