# web-app Specification

## Purpose
The customer web app (`apps/web`): its shell, where it is served, how it reaches the core service, and the gates every customer page passes.

## Requirements

### Requirement: Customer site shell
Every customer page SHALL render inside a shell made of a banner that is the `brand` band holding the "ShopperStop" wordmark in `on-brand` text and an "Enter pincode" button, and a main region holding the page, on the `canvas` background; the page title SHALL be the only level-1 heading. The index route `/` SHALL be the Home page, which before a pincode is chosen shows a "Set your pincode" empty state on a `surface` card.

#### Scenario: Home renders in the shell
- **WHEN** the app renders the path `/`
- **THEN** the banner contains "ShopperStop" and an "Enter pincode" button, the level-1 heading is "Groceries in minutes", it is the only level-1 heading, and a "Set your pincode" heading is shown

### Requirement: Customer site not found
A path no route matches SHALL render "Page not found" as the level-1 heading inside the shell, with an empty state holding a link back to Home, never a blank page or the router's default text.

#### Scenario: Unknown customer path
- **WHEN** the app renders the path `/nope`
- **THEN** the banner is present, the level-1 heading is "Page not found", and a "Go to Home" link points to `/`

### Requirement: Customer site served at the root
The built app SHALL be served at the root path `/`, with its asset URLs and router paths unprefixed, so the same build works behind `vite preview` and behind Caddy's catch-all route.

#### Scenario: Built app opens at the root
- **WHEN** a browser opens `http://localhost:15173/` on the `vite preview` server of the built app
- **THEN** the Home page renders with the `canvas` page background and the `brand` banner background

#### Scenario: Not-found link returns home
- **WHEN** a browser on `http://localhost:15173/nope` follows the "Go to Home" link
- **THEN** the URL is `http://localhost:15173/` and the Home page renders

### Requirement: Customer site reaches core through a same-origin proxy
The app SHALL call the core service only by relative `/api/...` URLs; the dev server on port 5173 SHALL proxy `/api` to `http://localhost:8080` and the preview server on port 15173 SHALL proxy `/api` to `http://localhost:18080`.

#### Scenario: Web preview proxies to core
- **WHEN** core runs on port 18080 and a client requests `http://localhost:15173/api/core/v1/healthz`
- **THEN** the response is 200 with body `{"status":"ok"}`

### Requirement: Customer site end-to-end suite with axe
`npm run e2e` in `apps/web` SHALL run Playwright on Chromium only, starting core from `services/core` with the environment it is given and `vite preview` on port 15173, and SHALL run `@axe-core/playwright` on every page it visits, failing on any violation.

#### Scenario: Customer smoke pages pass axe
- **WHEN** `make e2e` runs the web suite
- **THEN** the Home page and the not-found page are each visited and axe reports no violations on either
