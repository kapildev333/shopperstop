# Design

## Context
`apps/web` does not exist. `apps/admin` (change `admin-apps-admin`, archived; PR #41) is on main and is the template: same files, same pins, same gates. Root `package.json` declares the `apps/*` workspace and runs `lint`, `typecheck`, `test -- --run`, `build` across workspaces; `make test-web` builds `packages/ui` first; `make e2e` migrates `shopperstop_core_e2e`, builds every workspace and runs each workspace's `e2e` script in turn with the e2e environment (core `:18080`, origins 15173/15174, e2e pepper). `services/core` serves `GET /api/core/v1/healthz` → 200 `{"status":"ok"}` without touching the database. `deploy/Caddyfile` serves the web build from its catch-all `handle` with `try_files {path} /index.html`, so the app lives at `/`.

Every file below was built and run in a scratch spike on 2026-10-12 (Node 22.23.3, the branch base 90c26f7, which differs from origin/main c3879e3 only in PLAN.md; local Postgres up): lint, typecheck, Vitest (2 files, 3 tests), `vite build`, and Playwright with `CI=1` and the `make e2e` environment (4 tests: axe on two pages, the not-found link, the `/api` proxy against a real core) all green. The generated `routeTree.gen.ts` is byte-identical to `apps/admin`'s (same two routes).

## Goals / Non-Goals
**Goals:** the plan's file list for `apps/web`, each gate real and green; the shell Phase 2 grows into (Spec 2 §7 Home at its emptiest); one worker task.

**Non-Goals:** the pincode sheet, `localStorage` pincode, store resolution, search, category rail, cart bar and drawer, sign-in, every other Spec 2 §7 page; TanStack Query, `openapi-fetch` and the typed client (first API call); a navigation landmark (Spec 2 §7 has no tab nav; the category rail is Phase 2); Figma push-back (the Customer web page already has the Home frames this shell is the emptiest form of).

## Decisions

### Files (all under `apps/web/`)
```
package.json, vite.config.ts, tsconfig.json, eslint.config.js, playwright.config.ts, index.html
src/main.tsx, src/index.css, src/test-setup.ts, src/routeTree.gen.ts (generated, committed)
src/routes/__root.tsx, src/routes/index.tsx
src/no-literal-colors.test.ts, src/shell.test.tsx
e2e/smoke.spec.ts
```
`dist/`, `test-results/`, `playwright-report/` are already gitignored at the root.

### Copied unchanged from `apps/admin`
`tsconfig.json`, `eslint.config.js`, `src/index.css`, `src/test-setup.ts`, `src/no-literal-colors.test.ts`. Byte-identical; do not edit.

### Package
`apps/admin/package.json` with exactly two changes: `"name": "@shopperstop/web"`, and `"lucide-react": "1.55.0"` added to `dependencies` (alphabetical, between `@tanstack/react-router` and `react`). Every other pin, script and field identical (TypeScript 5.9.3 per D18; `@vitejs/plugin-react` per D10).
- `lucide-react` is in the CLAUDE.md stack and is the `packages/ui` pin; the app renders its own icon (the header pin, `MapPin`), so it declares the dependency rather than relying on hoisting.
- Not added (YAGNI): `@tanstack/react-query`, `openapi-fetch` 0.17.0 (allowed by the ui contract; arrives with the first API call in Phase 2), `@testing-library/user-event` (no interaction to test in jsdom).

### Config files
`vite.config.ts`: admin's, without `base`, on web's ports:
```ts
/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:8080' } },
  preview: { port: 15173, strictPort: true, proxy: { '/api': 'http://localhost:18080' } },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
})
```

`playwright.config.ts`: admin's with both `http://localhost:15174/admin/` URLs replaced by `http://localhost:15173/` (the `use.baseURL` and the `vite preview` `url`). Core `webServer` entry unchanged.

`index.html`: admin's with `<title>ShopperStop</title>`.

`src/main.tsx`: admin's with `createRouter({ routeTree })` (no `basepath`).

`src/routeTree.gen.ts`: written by the router plugin on `vite build`, `vite` or `vitest`; committed; never edited by hand.

### Served at `/`
No Vite `base` and no router `basepath`: Caddy's catch-all serves the web build unprefixed, and `vite preview` and the dev server serve it at `/`. Unknown deep links reach `index.html` through Caddy's `try_files` and `vite preview`'s SPA fallback, so the router's not-found page renders.

### Shell (`src/routes/__root.tsx`)
```tsx
import { Outlet, createLink, createRootRoute } from '@tanstack/react-router'
import { Button, ButtonLink, Card, EmptyState, PageHeader } from '@shopperstop/ui'
import { MapPin } from 'lucide-react'

const RouterButtonLink = createLink(ButtonLink)

function RootLayout() {
  return (
    <>
      <header className="flex items-center justify-between gap-4 bg-brand px-4 py-3 sm:px-6">
        <div className="text-h2 text-on-brand">ShopperStop</div>
        <Button variant="secondary">
          <MapPin size={16} aria-hidden />
          Enter pincode
        </Button>
      </header>
      <main className="px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Page not found" />
      <Card className="p-6">
        <EmptyState
          title="Nothing at this address"
          description="The link may be old or mistyped."
          action={<RouterButtonLink to="/">Go to Home</RouterButtonLink>}
        />
      </Card>
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})
```
- The banner is the brand band itself (Spec 1 §8.1: `brand` is the header band and pincode bar). Yellow carries only `on-brand` text and the `secondary` Button (`surface` fill, `ink` text); green `ghost` or `TabNav` text on yellow fails axe `color-contrast` (admin-P1-L1 finding).
- The pincode control is the "header pin" of Spec 2 §7: a real `<button>` with a 16 px `MapPin` (`aria-hidden`, visible text names it). Phase 1 gives it no handler; Phase 2 opens the pincode `Sheet` from it and shows the chosen pincode as its text.
- Wordmark is a `div`, not a heading: the page title stays the only `h1` (same reasoning as admin).
- No navigation landmark: Spec 2 §7 has none on Home; the category rail comes with the catalog pages.
- Not-found uses `createLink(ButtonLink)`, the ui contract for router links that look like buttons; `href` is `/` and navigation stays client-side. The `Card` is required: `EmptyState`'s description is `ink-muted`, 4.47:1 on `canvas`, passing only on `surface`.
- `PageHeader` carries no description on the canvas, for the same contrast reason.

### Home placeholder (`src/routes/index.tsx`)
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { Card, EmptyState, PageHeader } from '@shopperstop/ui'

function Home() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Groceries in minutes" />
      <Card className="p-6">
        <EmptyState title="Set your pincode" description="Enter your pincode to see the store that delivers to you." />
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Home,
})
```
Axe's `page-has-heading-one` (best practice, on by default) needs an `h1`; "Groceries in minutes" is the title until Phase 2 replaces Home's body.

### Tests
`src/no-literal-colors.test.ts` › "no literal colours in src": copied from admin (guard, green from the start).

`src/shell.test.tsx` renders the real route tree in a memory history, as admin's does:
```tsx
import { render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { expect, test } from 'vitest'
import { routeTree } from './routeTree.gen'

function renderAt(path: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) })
  render(<RouterProvider router={router} />)
}

test('home renders in the shell', async () => {
  renderAt('/')
  expect(await screen.findByRole('heading', { level: 1, name: 'Groceries in minutes' })).toBeInTheDocument()
  const banner = screen.getByRole('banner')
  expect(banner).toHaveTextContent('ShopperStop')
  expect(within(banner).getByRole('button', { name: 'Enter pincode' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Set your pincode' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
})

test('unknown customer path', async () => {
  renderAt('/nope')
  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(screen.getByRole('banner')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Nothing at this address' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/')
})
```
jsdom prints "Not implemented: Window's scrollTo()" from the router; harmless.

`e2e/smoke.spec.ts`:
```ts
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('home passes axe', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Groceries in minutes' })).toBeVisible()
  await expect(page.getByRole('banner')).toContainText('ShopperStop')
  await expect(page.getByRole('button', { name: 'Enter pincode' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 246, 248)')
  await expect(page.getByRole('banner')).toHaveCSS('background-color', 'rgb(248, 203, 70)')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('not found passes axe', async ({ page }) => {
  await page.goto('/nope')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('not found link returns home', async ({ page }) => {
  await page.goto('/nope')
  await page.getByRole('link', { name: 'Go to Home' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Groceries in minutes' })).toBeVisible()
})

test('web preview proxies to core', async ({ request }) => {
  const response = await request.get('/api/core/v1/healthz')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})
```
`rgb(245, 246, 248)` is `canvas`, `rgb(248, 203, 70)` is `brand`: together they prove the CSS loaded from the root. Axe runs with its defaults (WCAG A/AA plus best practices). Running the suite by hand needs the five `E2E_ENV` variables from the Makefile exported and built `packages/ui` and `apps/web`; Playwright does not build.

### Scenario to test map
| Scenario | Test |
|---|---|
| Home renders in the shell | `src/shell.test.tsx` › "home renders in the shell" |
| Unknown customer path | `src/shell.test.tsx` › "unknown customer path" |
| Built app opens at the root | `e2e/smoke.spec.ts` › "home passes axe" (canvas and brand backgrounds) |
| Not-found link returns home | `e2e/smoke.spec.ts` › "not found link returns home" |
| Web preview proxies to core | `e2e/smoke.spec.ts` › "web preview proxies to core" |
| Customer smoke pages pass axe | `e2e/smoke.spec.ts` › "home passes axe", "not found passes axe" |
| design-system "Literal colour fails the gate" (web) | `src/no-literal-colors.test.ts` › "no literal colours in src" |
| design-system "Axe on every e2e page" (web) | the two axe tests; "not found link returns home" visits only pages the axe tests already cover |

### Simplifications and ceilings
- One task, one worker: thirteen small files in one dependency chain, most copied from admin. Ceiling: none for Phase 1; Phase 2 pages are separate tasks.
- The pincode button has no handler. Ceiling: Phase 2 (serviceability) wires it to the pincode `Sheet` and the `shopperstop:pincode` value.
- Wordmark is text. Ceiling: a logo asset when the brand gets one.
- Home's title "Groceries in minutes" is placeholder copy. Ceiling: Phase 2 Home replaces the body with the category tiles and "Picked for you".
- Core starts per app suite: `make e2e` runs admin's suite then web's, each starting and stopping core on 18080. Ceiling: a shared global setup if e2e time matters.
- `reuseExistingServer` outside CI: a stale core on 18080 or preview on 15173 is reused locally. CI never reuses.

## Risks / Trade-offs
- [Playwright 1.64.0 needs Chromium revision 1248] → already installed on this machine by admin's spike; CI installs it.
- [`routeTree.gen.ts` regenerated by a newer router plugin differs] → exact pins; any drift shows in `git status` after the build gate.
- [Port 15173 or 18080 held by another manager's e2e] → one `make e2e` at a time across managers (CLAUDE.md); `strictPort` fails loudly instead of drifting.
