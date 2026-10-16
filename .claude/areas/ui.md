# ui
Scope: `packages/ui/`
Depends on: platform (root `package.json` workspaces, landed)
Spec: Spec 1 §8, §10; plan task 9
## Doing
Nothing running. Phase 1 complete (ui-P1-L1, ui-P1-L2); Phase 2 lanes open only on requests (ui-P2-L1 done). No `make e2e` here.

## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
| ui-P1-L1 | Task 9 `packages/ui` (`@shopperstop/ui`) | `packages/ui/`, `openspec/changes/ui-packages-ui/` | done 2026-10-12: PR #20 (squash), archive PR #21. 8 worker tasks (1 alone, 2 to 7 parallel, 8 after 2), each reviewed (approve) and gate-verified by the manager; team lead acceptance pass (44 delta scenarios + 6 seeded scenarios have same-named tests). Manager evidence: `make test-web` green on the merged head (24 files, 51 tests), `openspec validate --all --strict` pass, scratch Vite app built against the real `dist` and exercised in Chrome (tokens, Stepper, Dialog Escape, Sheet drawer, bundled Inter, `@source` from an app). ci failed on the account billing block only (zero steps) |
| ui-P1-L2 | generated API types from `services/core/openapi.json` (`gen:api`, `src/api/core.d.ts`, `./api` export) | `packages/ui/`, `openspec/changes/ui-api-types/` | done 2026-10-12: PR #33 (squash), archive PR #34. One worker task, reviewer approve, team lead acceptance pass. Manager evidence: `make test-web` green on the merge with origin/main (25 files, 53 tests), `gen:api` leaves a clean tree, a stale `core.d.ts` fails the test, one `typescript` 5.9.3 in the tree (D18). ci failed on the billing block only |
| ui-P2-L1 | `TabNav` scrolls horizontally without wrapping (orchestrator request for admin's seven-link nav at 375 px) | `packages/ui/src/tab-nav*`, `openspec/changes/ui-tabnav-scroll/` | done 2026-10-12: PR #82 (squash), archive PR #84. One worker task, reviewer approve, team lead acceptance pass. Manager evidence: `make test-web` green for ui, admin and web on the merge (54 + 31 + 20 tests); Chrome, seven links in a 320 px container: one line, scrolls to the last link, focus ring inset and fully visible on first and last link. ci failed on the billing block only |

## Requests
- from admin (admin-P2-L5, relayed by the orchestrator 2026-10-13): a visually hidden live-region pattern; `Dialog` and `Sheet` that stack; a compact button size for an order number in a card or table cell. With the three requests below this makes ui-P2-L2's package; the apps carry app-level versions until then.
- from web (web-P2-L4, relayed by the orchestrator 2026-10-13, optional): a single-choice control (radio group semantics) for choosing one of a few options; checkout uses `Chip`s with `aria-pressed` until then. Same lane as `ImageTile` (ui-P2-L2).
- from admin (admin-P2-L4, relayed by the orchestrator 2026-10-13): style `Button` and `ButtonLink` for `aria-disabled="true"` like `disabled` (keeps keyboard focus on a pager or save button that cannot act). Admin's `/stock` carries `aria-disabled:cursor-not-allowed aria-disabled:opacity-50` on the page until then. Same lane as `ImageTile` (ui-P2-L2).
- from admin (admin-P2-L3, relayed by the orchestrator 2026-10-13): an `ImageTile` in `packages/ui`: 1:1 tile, `canvas` placeholder with a Lucide icon when there is no image, with a test and a Figma component. Both apps need it (web has the same recipe in `web-serviceability-catalog`); admin ships an app-level copy in `apps/admin/src/image.tsx` until it lands, then swaps. Optional later: a `Textarea` for the product description. Next ui lane: ui-P2-L2.
- to core (standing, D19): a core PR that changes `services/core/openapi.json` regenerates `packages/ui/src/api/core.d.ts` with `make gen` in the same PR; never hand-edited.
- to web and admin (contract): `"@shopperstop/ui": "*"`; `src/index.css` = `@import "tailwindcss"; @import "@shopperstop/ui/tokens.css";`; `bg-canvas text-ink` on `body`; components from `@shopperstop/ui`; `no-literal-colors.test.ts` uses `findLiteralColors(dirname(fileURLToPath(import.meta.url)))` from `@shopperstop/ui/testing`; router links via `createLink(ButtonLink)`; API types via `import type { paths, components } from '@shopperstop/ui/api'` with the app's own `openapi-fetch` 0.17.0 and `createClient<paths>({ baseUrl: '/api/core/v1' })`; the apps own the "Axe on every e2e page" scenario; `packages/ui` builds before app gates (`make test-web` orders it).

## Found
- ui-P2-L1: `overflow-x-auto` also clips vertically, so the focus ring inside a scroll container must be inset (`outline-offset: -2px` on the links); the same applies to any future scrolling container that holds focusable children. Figma TabNav component needs the "scrolls horizontally, never wraps" note (orchestrator).
- Resolved: D10 (typescript-eslint and implied dev tooling), D11 (Node >= 22.12; lanes used `~/.local/node-v22.23.3/bin`, nothing global changed), D12 (`line-strong` #868C94).
- Measured in tests: accent/success/danger on their soft surfaces are below 4.5:1, so text on `*-soft` surfaces is `ink` (or `accent-hover` on `accent-soft`); `ink-muted` on `canvas` is 4.47:1, so muted text sits on `surface` only. Figma Task 14 should mirror this.
- `tokens.css` sets no `body` colour; each app puts `bg-canvas text-ink` on `body`.
- Pins: TypeScript 6.0.3, ESLint 9.39.5 (end of life until `eslint-plugin-jsx-a11y` supports 10), Tailwind 4.3.3, Vitest 5.0.4, Vite 8.3.4, jsdom 27.0.0.
- D18: `packages/ui` pins TypeScript 5.9.3 (`openapi-typescript` 7.13.0 needs `^5`); revisit when it supports 6. Apps may stay on 6; npm keeps separate copies.
- Figma export for `check-figma-tokens.mjs`: the `Color` collection, `Light` mode, as a nested DTCG JSON (`color/<token>`); run by hand before a design PR.
- A phone-width render was not captured in Chrome (window would not resize below desktop); the `max-sm:`/`sm:` classes are pinned by tests.

## Backlog
- `TabNav`: scroll the current link into view on page load (keyboard focus already does); add when a nav's current link can sit past phone width.
- `IconButton` accepts `type` (default `button` placed before the props spread) so an icon-only control can submit a form; web's search submits on Enter instead for now (orchestrator, 2026-10-12). Bundle into the next ui lane with a test.
- Add `--text-*: initial` to the theme if default Tailwind font sizes leak into the apps.
- Phase 2: new components only through a ui change with a test and a Figma component (CLAUDE.md); nothing queued.

## Phase 2 work package (orchestrator, 2026-10-12)
Spec: Spec 1 §8, §10; Spec 2 §7, §8 (what the pages need). No scheduled lane: `packages/ui/src/api/core.d.ts` is regenerated inside each core PR (D19), and the Phase 1 component set covers the Spec 2 screens drawn in Figma. The ui manager stays on the loop and opens a lane only on a request under `## Requests` in `.claude/areas/web.md` or `admin.md`: a new pattern an app needs (it goes into `packages/ui` with a test and a Figma component, never as a one-off in an app), a token or component fix from an axe finding, or a change to `Price`/`formatInr`, `Stepper`, `Sheet` or `Table` behaviour. Before any design PR, run `scripts/check-figma-tokens.mjs` against a Figma variables export (Color, Light).

## Phase 3 work package (orchestrator, 2026-10-15)
Spec: PLAN.md Phase 3, D34 (components) and D29/D19 (rider types); Spec 1 §8, §10; CLAUDE.md UI conventions. Every component lands with a test, a Figma component (orchestrator draws it in the `Tokens & Components` page on request under `## Requests`; the lane does not wait) and an export from `@shopperstop/ui`.

| Lane | Change | Deliverable |
|---|---|---|
| ui-P3-L1 | `ui-components-backlog` (MODIFIED `design-system`) | the queued requests from the apps: `ImageTile` (1:1, `canvas` placeholder with a Lucide icon, `alt` required or decorative); `Button` and `ButtonLink` styled for `aria-disabled="true"` like `disabled` (focusable); a single-choice control (`ChoiceGroup`: `radiogroup` semantics, keyboard arrows, pill chips, used by checkout's address choice and the rider app's confirmations); `VisuallyHidden` with a `live` variant (`aria-live="polite"` region); `Dialog` and `Sheet` that stack (focus returns to the opener of each layer, Escape closes the top one); `Button` `size="compact"` for an order number in a card or table cell; `Table` `stack` puts a gap (or the label above the value) between a cell's label and value at phone width; `IconButton` accepts `type` (default `button`); `TabNav` scrolls the current link into view on mount. Tell web and admin under `## Requests` when it is on main so they swap their app-level copies (`apps/admin/src/image.tsx`, web's product image tile, checkout's `Chip` group, admin's live region and `aria-disabled` classes) |
| ui-P3-L2 | `ui-rider-api-types` | `gen:api` generates `src/api/rider.d.ts` from `services/rider/openapi.json` next to `core.d.ts` (`@shopperstop/ui/api/rider` export), the stale test covers both files, `make gen` (platform-P3-L1) runs both. Waits on rider-P3-L1 on main; from then on a rider lane that changes its `openapi.json` commits the regenerated file in its PR (D19 extended) |

Gates per PR: `make test-web`, `openspec validate --all --strict`, `scripts/check-figma-tokens.mjs` unchanged unless tokens change.
