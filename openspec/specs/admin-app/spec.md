# admin-app Specification

## Purpose
The admin and store-staff web app (`apps/admin`): its shell, where it is served, how it reaches the core service, and the gates every admin page passes.

## Requirements

### Requirement: Admin shell
Every admin page SHALL render inside a shell made of a banner holding the brand band with the "ShopperStop Admin" wordmark, a navigation landmark named "Admin" on a `surface` strip whose link to the current page carries `aria-current="page"`, and a main region holding the page; the page title SHALL be the only level-1 heading. The index route `/` SHALL be the Dashboard page.

#### Scenario: Dashboard renders in the shell
- **WHEN** the app renders the path `/`
- **THEN** the banner contains "ShopperStop Admin", the navigation landmark "Admin" holds a "Dashboard" link with `aria-current="page"`, and the level-1 heading is "Dashboard"

### Requirement: Unknown paths show not found
A path no route matches SHALL render "Page not found" as the level-1 heading inside the shell, never a blank page or the router's default text.

#### Scenario: Unknown path
- **WHEN** the app renders the path `/nope`
- **THEN** the banner is present and the level-1 heading is "Page not found"

### Requirement: Served under /admin/
The built app SHALL be served under the `/admin/` path prefix, with its asset URLs and router paths under that prefix, so the same build works behind `vite preview` and behind Caddy's `/admin/*` route.

#### Scenario: Built app opens under the prefix
- **WHEN** a browser opens `http://localhost:15174/admin/` on the `vite preview` server of the built app
- **THEN** the Dashboard page renders with its styles and the "Dashboard" link points to `/admin/`

### Requirement: Core reached through a same-origin proxy
The app SHALL call the core service only by relative `/api/...` URLs; the dev server SHALL proxy `/api` to `http://localhost:8080` and the preview server SHALL proxy `/api` to `http://localhost:18080`.

#### Scenario: Preview proxies to core
- **WHEN** core runs on port 18080 and a client requests `http://localhost:15174/api/core/v1/healthz`
- **THEN** the response is 200 with body `{"status":"ok"}`

### Requirement: End-to-end suite with axe
`npm run e2e` in `apps/admin` SHALL run Playwright on Chromium only, starting core from `services/core` with the environment it is given and `vite preview` on port 15174, and SHALL run `@axe-core/playwright` on every page it visits, failing on any violation.

#### Scenario: Smoke pages pass axe
- **WHEN** `make e2e` runs the admin suite
- **THEN** the Dashboard page and the not-found page are each visited and axe reports no violations on either
