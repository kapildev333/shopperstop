# ui
Scope: `packages/ui/`
Depends on: platform (root `package.json` workspaces, landed)
Spec: Spec 1 §8, §10; plan task 9
## Doing
Nothing running. Phase 1 ui work is complete; next lane waits on core's `openapi.json`. No `make e2e` here.

## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
| ui-P1-L1 | Task 9 `packages/ui` (`@shopperstop/ui`) | `packages/ui/`, `openspec/changes/ui-packages-ui/` | done 2026-10-12: PR #20 (squash), archive PR #21. 8 worker tasks (1 alone, 2 to 7 parallel, 8 after 2), each reviewed (approve) and gate-verified by the manager; team lead acceptance pass (44 delta scenarios + 6 seeded scenarios have same-named tests). Manager evidence: `make test-web` green on the merged head (24 files, 51 tests), `openspec validate --all --strict` pass, scratch Vite app built against the real `dist` and exercised in Chrome (tokens, Stepper, Dialog Escape, Sheet drawer, bundled Inter, `@source` from an app). ci failed on the account billing block only (zero steps) |

## Requests
- to core: `services/core/openapi.json` on origin/main; unblocks the follow-up ui change for `src/api/core.d.ts`.
- to web and admin (contract): `"@shopperstop/ui": "*"`; `src/index.css` = `@import "tailwindcss"; @import "@shopperstop/ui/tokens.css";`; `bg-canvas text-ink` on `body`; components from `@shopperstop/ui`; `no-literal-colors.test.ts` uses `findLiteralColors(dirname(fileURLToPath(import.meta.url)))` from `@shopperstop/ui/testing`; router links via `createLink(ButtonLink)`; the apps own the "Axe on every e2e page" scenario; `packages/ui` builds before app gates (`make test-web` orders it).

## Found
- Resolved: D10 (typescript-eslint and implied dev tooling), D11 (Node >= 22.12; lanes used `~/.local/node-v22.23.3/bin`, nothing global changed), D12 (`line-strong` #868C94).
- Measured in tests: accent/success/danger on their soft surfaces are below 4.5:1, so text on `*-soft` surfaces is `ink` (or `accent-hover` on `accent-soft`); `ink-muted` on `canvas` is 4.47:1, so muted text sits on `surface` only. Figma Task 14 should mirror this.
- `tokens.css` sets no `body` colour; each app puts `bg-canvas text-ink` on `body`.
- Pins: TypeScript 6.0.3, ESLint 9.39.5 (end of life until `eslint-plugin-jsx-a11y` supports 10), Tailwind 4.3.3, Vitest 5.0.4, Vite 8.3.4, jsdom 27.0.0.
- `openapi-typescript` 7 declares TypeScript `^5`; the follow-up change must resolve that (override, or wait for a release) before `gen:api` lands.
- A phone-width render was not captured in Chrome (window would not resize below desktop); the `max-sm:`/`sm:` classes are pinned by tests.

## Backlog
- ui-P1-L2 (follow-up change `ui-api-types`): `openapi-typescript` dev dependency, `gen:api` script, `src/api/core.d.ts`, `./api` export; `make gen` already calls `gen:api --if-present`. Starts when core's `openapi.json` is on main.
- Add `--text-*: initial` to the theme if default Tailwind font sizes leak into the apps.
