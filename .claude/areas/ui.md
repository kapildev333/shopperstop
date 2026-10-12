# ui
Scope: `packages/ui/`
Depends on: platform (root `package.json` workspaces, landed)
Spec: Spec 1 §8, §10; plan task 9
## Doing
Nothing running. Phase 1 ui work is complete (ui-P1-L1, ui-P1-L2). No `make e2e` here.

## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
| ui-P1-L1 | Task 9 `packages/ui` (`@shopperstop/ui`) | `packages/ui/`, `openspec/changes/ui-packages-ui/` | done 2026-10-12: PR #20 (squash), archive PR #21. 8 worker tasks (1 alone, 2 to 7 parallel, 8 after 2), each reviewed (approve) and gate-verified by the manager; team lead acceptance pass (44 delta scenarios + 6 seeded scenarios have same-named tests). Manager evidence: `make test-web` green on the merged head (24 files, 51 tests), `openspec validate --all --strict` pass, scratch Vite app built against the real `dist` and exercised in Chrome (tokens, Stepper, Dialog Escape, Sheet drawer, bundled Inter, `@source` from an app). ci failed on the account billing block only (zero steps) |
| ui-P1-L2 | generated API types from `services/core/openapi.json` (`gen:api`, `src/api/core.d.ts`, `./api` export) | `packages/ui/`, `openspec/changes/ui-api-types/` | done 2026-10-12: PR #33 (squash), archive PR #34. One worker task, reviewer approve, team lead acceptance pass. Manager evidence: `make test-web` green on the merge with origin/main (25 files, 53 tests), `gen:api` leaves a clean tree, a stale `core.d.ts` fails the test, one `typescript` 5.9.3 in the tree (D18). ci failed on the billing block only |

## Requests
- to core (standing, D19): a core PR that changes `services/core/openapi.json` regenerates `packages/ui/src/api/core.d.ts` with `make gen` in the same PR; never hand-edited.
- to web and admin (contract): `"@shopperstop/ui": "*"`; `src/index.css` = `@import "tailwindcss"; @import "@shopperstop/ui/tokens.css";`; `bg-canvas text-ink` on `body`; components from `@shopperstop/ui`; `no-literal-colors.test.ts` uses `findLiteralColors(dirname(fileURLToPath(import.meta.url)))` from `@shopperstop/ui/testing`; router links via `createLink(ButtonLink)`; API types via `import type { paths, components } from '@shopperstop/ui/api'` with the app's own `openapi-fetch` 0.17.0 and `createClient<paths>({ baseUrl: '/api/core/v1' })`; the apps own the "Axe on every e2e page" scenario; `packages/ui` builds before app gates (`make test-web` orders it).

## Found
- Resolved: D10 (typescript-eslint and implied dev tooling), D11 (Node >= 22.12; lanes used `~/.local/node-v22.23.3/bin`, nothing global changed), D12 (`line-strong` #868C94).
- Measured in tests: accent/success/danger on their soft surfaces are below 4.5:1, so text on `*-soft` surfaces is `ink` (or `accent-hover` on `accent-soft`); `ink-muted` on `canvas` is 4.47:1, so muted text sits on `surface` only. Figma Task 14 should mirror this.
- `tokens.css` sets no `body` colour; each app puts `bg-canvas text-ink` on `body`.
- Pins: TypeScript 6.0.3, ESLint 9.39.5 (end of life until `eslint-plugin-jsx-a11y` supports 10), Tailwind 4.3.3, Vitest 5.0.4, Vite 8.3.4, jsdom 27.0.0.
- D18: `packages/ui` pins TypeScript 5.9.3 (`openapi-typescript` 7.13.0 needs `^5`); revisit when it supports 6. Apps may stay on 6; npm keeps separate copies.
- Figma export for `check-figma-tokens.mjs`: the `Color` collection, `Light` mode, as a nested DTCG JSON (`color/<token>`); run by hand before a design PR.
- A phone-width render was not captured in Chrome (window would not resize below desktop); the `max-sm:`/`sm:` classes are pinned by tests.

## Backlog
- Add `--text-*: initial` to the theme if default Tailwind font sizes leak into the apps.
- Phase 2: new components only through a ui change with a test and a Figma component (CLAUDE.md); nothing queued.
