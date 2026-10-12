# Design

## Context
`apps/admin` does not exist. Root `package.json` declares the `apps/*` workspace and runs `lint`, `typecheck`, `test -- --run`, `build` across workspaces; `make test-web` builds `packages/ui` first, `make e2e` migrates `shopperstop_core_e2e`, builds every workspace and runs each `e2e` script with the e2e environment (core `:18080`, origins 15173/15174, e2e pepper). `services/core` is on main (core-P1-L1): `go run ./cmd/core` serves `GET /api/core/v1/healthz` → 200 `{"status":"ok"}` without touching the database. `deploy/Caddyfile` serves the admin build at `/admin/*` with the prefix stripped. The ui contract (area plan ui, `## Requests`) fixes `index.css`, the body classes, the matcher and the build order.

Every version and config below was installed and run in a scratch spike on 2026-10-12 (Node 22.23.3, the `packages/ui` of a2cea62, `services/core` of origin/main 6ae9c6b, local Postgres): lint, typecheck, Vitest (3 tests), `vite build`, and Playwright (3 tests: axe on two pages, the proxy against a real core) all green.

## Goals / Non-Goals
**Goals:** the plan's file list for an app, each gate real and green; the shell Phase 2 grows into; one worker task.

**Non-Goals:** sign-in, auth guard, role-based nav, Spec 2 §8 pages, TanStack Query, the typed API client, icons, a phone-width layout beyond the gutters, Figma push-back (the shell has no frame of its own; the "Admin web" Figma page is the Phase 2 reference).

## Decisions

### Files (all under `apps/admin/`)
```
package.json, vite.config.ts, tsconfig.json, eslint.config.js, playwright.config.ts, index.html
src/main.tsx, src/index.css, src/test-setup.ts, src/routeTree.gen.ts (generated, committed)
src/routes/__root.tsx, src/routes/index.tsx
src/no-literal-colors.test.ts, src/shell.test.tsx
e2e/smoke.spec.ts
```
`dist/`, `test-results/`, `playwright-report/` are already gitignored at the root.

### Package
- `"name": "@shopperstop/admin"`, `"private": true`, `"type": "module"`, `"version": "0.0.0"`.
- scripts: `"dev": "vite"`, `"build": "vite build"`, `"typecheck": "tsc -p tsconfig.json"`, `"lint": "eslint ."`, `"test": "vitest"` (gates pass `-- --run`), `"e2e": "playwright test"`. `build` does not run `tsc`; `typecheck` is its own gate.
- `dependencies` (exact): `@shopperstop/ui` `*`, `@tanstack/react-router` 1.170.42, `react` 19.3.0, `react-dom` 19.3.0.
- `devDependencies` (exact): `@axe-core/playwright` 4.13.0, `@playwright/test` 1.64.0, `@tailwindcss/vite` 4.3.3, `@tanstack/router-plugin` 1.168.43, `@testing-library/dom` 10.4.2, `@testing-library/jest-dom` 7.0.1, `@testing-library/react` 16.3.3, `@types/node` 22.20.5, `@types/react` 19.3.0, `@types/react-dom` 19.3.0, `@vitejs/plugin-react` 6.1.2, `eslint` 9.39.5, `eslint-plugin-jsx-a11y` 6.10.2, `eslint-plugin-react-hooks` 7.1.1, `jsdom` 27.0.0, `tailwindcss` 4.3.3, `typescript` 6.0.3, `typescript-eslint` 8.71.2, `vite` 8.3.4, `vitest` 5.0.4. Same pins as `packages/ui` where shared.
- Not added (YAGNI): `@tanstack/react-query`, `openapi-fetch` (first API call, Phase 2); `lucide-react` (comes with ui; add when the app renders its own icon); `@testing-library/user-event` (no interaction to test yet).
- `@vitejs/plugin-react` is dev tooling implied by "React + Vite" (D10): React Fast Refresh in dev. Without it Vite 8 still compiles JSX; the only loss would be full reloads.

### Config files
`vite.config.ts` (also the Vitest config; no separate `vitest.config.ts`):
```ts
/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/admin/',
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  server: { port: 5174, strictPort: true, proxy: { '/api': 'http://localhost:8080' } },
  preview: { port: 15174, strictPort: true, proxy: { '/api': 'http://localhost:18080' } },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
})
```
The router plugin must come before `react()`. `include` keeps Vitest away from `e2e/`.

`tsconfig.json`: as `packages/ui/tsconfig.json` (ES2022, bundler resolution, `react-jsx`, `strict`, `noEmit`, `skipLibCheck`) with `"types": ["node", "vite/client"]` and `"include": ["src", "e2e", "vite.config.ts", "playwright.config.ts"]`.

`eslint.config.js`: `packages/ui`'s config with ignores `['dist', 'src/routeTree.gen.ts', 'test-results', 'playwright-report']`.

`index.html`: `<html lang="en">`, `<meta charset="UTF-8">`, viewport meta, `<title>ShopperStop Admin</title>`, `<body class="bg-canvas text-ink">` (ui contract), `<div id="root">`, `<script type="module" src="/src/main.tsx">`. No font link: the ui entry imports Inter.

`src/index.css`: exactly `@import "tailwindcss";` and `@import "@shopperstop/ui/tokens.css";` on two lines.

`src/test-setup.ts`: identical to `packages/ui/src/test-setup.ts`.

`src/main.tsx`: `createRouter({ routeTree, basepath: '/admin' })`, the `Register` module augmentation, `createRoot(document.getElementById('root')!)` rendering `<StrictMode><RouterProvider router={router} /></StrictMode>`, and `import './index.css'`.

`src/routeTree.gen.ts`: written by the router plugin on `vite build`, `vite` or `vitest`; committed (plan file list) so `typecheck` works on a clean checkout. Never edited by hand.

### Served under `/admin/`
Caddy strips `/admin` and serves `dist`, so asset URLs in `index.html` must already start with `/admin/`; Vite `base: '/admin/'` does that and `vite preview` and the dev server then serve the app at `/admin/`. The router gets `basepath: '/admin'` so `<Link to="/">` renders `href="/admin/"`. Alternative rejected: base `/` with a separate prod build, two builds for one app. Consequence: the dev URL is `http://localhost:5174/admin/` (Vite shows a "did you mean /admin/" page at `/`). Tests use a memory history without basepath, so route paths in tests are `/` and `/nope`.

### Shell (`src/routes/__root.tsx`)
`createRootRoute({ component: RootLayout, notFoundComponent })`.
- `RootLayout`: `<header>` (the banner) containing a `div` `bg-brand px-4 py-3 text-h3 text-on-brand sm:px-6` with the text "ShopperStop Admin", then `<TabNav label="Admin" className="bg-surface px-4 sm:px-6">` holding `<Link to="/">Dashboard</Link>`; then `<main className="px-4 py-6 sm:px-6"><Outlet /></main>`.
- `notFoundComponent`: `<PageHeader title="Page not found" />`. It renders inside `RootLayout`'s `Outlet`, so the banner stays.
- TanStack Router's `Link` sets `aria-current="page"` on the active link, which `TabNav` styles as current (accent on surface).
- Why the nav is not on the brand band: the spike's axe run failed `color-contrast` with `TabNav` on `bg-brand` (accent and ink-muted text on yellow). `TabNav` is a surface component; yellow carries only the wordmark (`on-brand`).
- Why the wordmark is a `div`, not a heading: the page title must be the only `h1`; a second heading level for a logo adds noise to the outline.
- No `createLink(ButtonLink)` yet: the shell has no button-styled link. The first page that needs one creates it (ui contract).

### Dashboard placeholder (`src/routes/index.tsx`)
`createFileRoute('/')({ component: Dashboard })`; `Dashboard` renders `<div className="flex flex-col gap-6">` with `<PageHeader title="Dashboard" />` and `<Card className="p-6"><EmptyState title="No stores to show yet" description="Store cards appear here after sign-in." /></Card>`. The `Card` is required, not decoration: `EmptyState`'s description is `ink-muted`, which measures 4.47:1 on `canvas` and passes only on `surface`. Same reason `PageHeader` gets no description on the canvas.

### Tests
`src/no-literal-colors.test.ts` › "no literal colours in src": `expect(findLiteralColors(dirname(fileURLToPath(import.meta.url)))).toEqual([])`, import from `@shopperstop/ui/testing`. Use `dirname(fileURLToPath(import.meta.url))`, not `new URL('.', ...)`, which throws under jsdom (ui-P1-L1-T1).

`src/shell.test.tsx` renders the real route tree: `createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) })` inside `render(<RouterProvider router={router} />)`, then `await screen.findBy...` (the router resolves asynchronously).
- "dashboard renders in the shell": `findByRole('heading', { level: 1, name: 'Dashboard' })`; `getByRole('banner')` has text "ShopperStop Admin"; `getByRole('navigation', { name: 'Admin' })` contains `getByRole('link', { name: 'Dashboard' })`, which has `aria-current="page"`; `getAllByRole('heading', { level: 1 })` has length 1.
- "unknown path": at `/nope`, `findByRole('heading', { level: 1, name: 'Page not found' })` and `getByRole('banner')` exist.
jsdom prints "Not implemented: Window's scrollTo()" from the router's scroll handling; harmless, left alone.

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test'

const reuseExistingServer = !process.env.CI

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  use: { baseURL: 'http://localhost:15174/admin/' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'go run ./cmd/core', cwd: '../../services/core', url: 'http://localhost:18080/api/core/v1/healthz', reuseExistingServer, timeout: 120_000 },
    { command: 'vite preview', url: 'http://localhost:15174/admin/', reuseExistingServer },
  ],
})
```
Core reads its environment from the process: `make e2e` (and CI through it) supplies it. Running `npm run e2e --workspace apps/admin` by hand needs the same five variables exported (values in the Makefile's `E2E_ENV`) and a built `packages/ui` and `apps/admin`; Playwright does not build. Core's `healthz` needs no migration, but `make e2e` migrates anyway.

`e2e/smoke.spec.ts` (`baseURL` ends in `/admin/`, so `page.goto('./')` and `'./nope'` resolve under the prefix; `request.get('/api/...')` resolves to the origin root):
- "dashboard passes axe": goto `./`; h1 "Dashboard" visible; banner contains "ShopperStop Admin"; link "Dashboard" has `href` `/admin/`; `body` computed `background-color` is `rgb(245, 246, 248)` (the `canvas` token, proving the CSS loaded under the prefix); `new AxeBuilder({ page }).analyze()` violations equal `[]`.
- "not found passes axe": goto `./nope`; h1 "Page not found" visible; axe violations equal `[]`.
- "preview proxies to core": `request.get('/api/core/v1/healthz')` → status 200, JSON `{ status: 'ok' }`.
Axe runs with its defaults (WCAG A/AA plus best practices: `region`, `page-has-heading-one`, `color-contrast`).

### Simplifications and ceilings
- One task, one worker: twelve small files in one dependency chain (every file needs the scaffold). Ceiling: none for Phase 1; Phase 2 pages are separate tasks.
- Shell nav is a single static link. Ceiling: role-based nav (Spec 2 §8) arrives with sign-in, which also brings the auth guard.
- Wordmark is text. Ceiling: a logo asset when the brand gets one.
- Core is started per app suite: web and admin suites each start and stop core on 18080 in turn. Ceiling: a shared global setup if e2e time matters.
- `reuseExistingServer` outside CI: a stale core on 18080 from another run is reused. Ceiling: acceptable locally; CI never reuses.
- Not-found is a heading only. Ceiling: Spec 2 §8's "unauthorised deep link shows the not_found empty state" adds an `EmptyState` with a link home when there is a home to return to after sign-in.

## Risks / Trade-offs
- [Admin e2e skipped by `make e2e` and CI while `apps/web` is absent: both guard on `services/core` and `apps/web`] → request to platform to guard on `apps/web` or `apps/admin`; until then the manager runs the admin suite by hand with the e2e environment.
- [Playwright 1.64.0 needs Chromium revision 1248; this machine had 1243] → `npx playwright install chromium` (user cache, done during the spike); CI installs it already.
- [`routeTree.gen.ts` regenerated by a newer router plugin differs] → pinned exact versions; the file is regenerated by every build, so a diff shows up in review, not in production.
- [Dev URL moved to `/admin/`] → README (platform, Task 15) should name `http://localhost:5174/admin/`.
