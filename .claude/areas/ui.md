# ui
Scope: `packages/ui/`
Depends on: platform (root `package.json` workspaces from task 1, landed)
Spec: Spec 1 §8, §10; plan task 9
## Doing
ui-P1-L1: change `ui-packages-ui` proposed and validated; waiting for the owner's go on the worker briefs. No `make e2e` here.

## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
| ui-P1-L1 | Task 9 `packages/ui` (`@shopperstop/ui`) | `packages/ui/`, `openspec/changes/ui-packages-ui/` | team lead done: 8 tasks (1 alone, 2 to 7 parallel, 8 after 2), `openspec validate --all --strict` 3 passed; workers wait on the owner's go, Node >= 22.12 for the lanes, and D-typescript-eslint |

## Requests
- to platform: raise root `engines.node` to `>=22.12.0` and use the same in CI (Vite 8, Vitest 5 and jsdom 27 refuse 22.11). CI and the Makefile must build `packages/ui` before any app typecheck, test or build (apps import `dist`). A future `make gen` calls the ui `gen:api` script once it exists.
- to core: `services/core/openapi.json` on origin/main (core-P1-L1), which unblocks the deferred `packages/ui/src/api/core.d.ts` as a follow-up ui change.
- to web and admin (contract, no action yet): `index.css` is `@import "tailwindcss"; @import "@shopperstop/ui/tokens.css";`; components from `@shopperstop/ui`, the literal-colour matcher from `@shopperstop/ui/testing`; router links wrap `ButtonLink` with `createLink`; the "Axe on every e2e page" scenario is owned by the two app suites.

## Found
- Decision needed (PLAN.md): `typescript-eslint` 8.71.2 as a devDependency of `packages/ui`. ESLint cannot parse TypeScript without it and it is not on the CLAUDE.md list. Recommended: approve as implied tooling, like `@types/*`, `@testing-library/dom` (peer of RTL) and `vite` (peer of Vitest), which the lane treats as not needing a decision.
- Decision needed (palette, Spec 1 §8.1): `line-strong` `#C9CDD2` on `surface` measures 1.60:1, below the spec's own 3:1 rule for borders; suggested `#868C94` (3.39:1 on surface, 3.14:1 on canvas). `ink-muted` on `canvas` is 4.47:1, so muted text sits on `surface` only. Three soft pairs are below 4.5:1, so text on `*-soft` surfaces is `ink` (or `accent-hover` on `accent-soft`); status colours on soft surfaces are icons and borders only.
- Pins: TypeScript 6.0.3 (TS 7 breaks the `typescript-eslint` peer range), ESLint 9.39.5 (end of life; `eslint-plugin-jsx-a11y` 6.10.2 declares only `^9`).
- `api/core.d.ts`, `openapi-typescript` and the `./api` export are deferred to a follow-up ui change after core's `openapi.json` lands (`openapi-typescript` 7 wants TypeScript `^5`, to be resolved then).
- Root `package-lock.json` changes mechanically on the lane's `npm install` (accepted by the orchestrator).
- Local toolchain: the machine's default Node is 22.11.0; the ui manager installed Node 22.23.3 under `~/.local/node-v22.23.3` for lane commands only (PATH prefix, nothing global). The owner may make it the default.

## Backlog
- ui follow-up change: `gen:api` + `src/api/core.d.ts` + `./api` export once `services/core/openapi.json` exists.
- Add `--text-*: initial` to the theme if default Tailwind font sizes leak into the apps.
