# Design: web-e2e-flows

Two files, both in `apps/web`: `playwright.config.ts` (one more `webServer` entry) and a new `e2e/flows.spec.ts` (two tests). No helper module: `e2e/shopper.ts` already holds what the flows need (`freshEmail`, `koramangala`, `orderPick`, `expectNoViolations`) and is not changed.

## Decision 1: the admin preview as a third webServer

Appended to the `webServer` array in `apps/web/playwright.config.ts`, after the web preview:

```ts
    // The cross-app flows (e2e/flows.spec.ts) drive the admin app too: its build, as `make e2e` made it, served as admin's own config does.
    { command: 'npx vite preview', cwd: '../admin', url: 'http://localhost:15174/admin/', reuseExistingServer },
```

- `cwd: '../admin'` makes `vite` read `apps/admin/vite.config.ts` (port 15174 `strictPort`, base `/admin/`, `/api` proxied to 18080). `npx` resolves `apps/admin/node_modules/.bin/vite` (vite is not hoisted to the root in this repo); a bare `vite` would take apps/web's binary from npm's PATH, which works today only because both pin the same version.
- Serve only, no build: `make e2e` runs `npm run build --workspaces` before any suite. Ceiling: a standalone `npm run e2e --workspace apps/web` needs `npm run build --workspace apps/admin` first, and serves a stale admin build if the admin source changed since; the `webServer` fails with vite's "dist not found" message when there is no build at all.
- `use.baseURL` stays the web origin. Admin pages are opened in a second browser context whose `baseURL` is `http://localhost:15174/admin/`, so relative paths (`./sign-in`, `./orders`) read as in admin's own suite.
- In `make e2e` the admin suite runs first (workspace order `apps/admin`, `apps/web`) and its Playwright stops its servers on exit, so port 15174 is free when the web suite starts its own.

## Decision 2: `e2e/flows.spec.ts`

Imports: `expect`, `test`, `type Page` from `@playwright/test`; `expectNoViolations`, `freshEmail`, `koramangala`, `orderPick` from `./shopper`. Constant `adminOrigin = 'http://localhost:15174/admin/'`. One local helper:

```ts
// Signs the browser in on the admin app; every flow does it once per role (core allows 10 sign-ins per email per hour).
async function staffSignIn(page: Page, email: string, password: string) {
  await page.goto('./sign-in')
  await expectNoViolations(page)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await expectNoViolations(page)
}
```

No `beforeEach` pincode: Flow 1 chooses the pincode in the sheet; Flow 2 sets it with an init script on its own page.

### Flow 1: test "customer order to delivered across both apps"

`test.slow()`. Fixtures `{ page, request, browser }`.

Products: `const a = await orderPick(request, 7)` and `const b = await orderPick(request, 8)` (stock exactly 10 each, price at least ₹20; indexes 0 to 6 are checkout's and orders' tests, 9 was the manager's manual walk). `minOrderCents` from `GET /api/core/v1/stores/${koramangala}`. Quantity of `a`: `const qa = Math.max(2, Math.ceil((minOrderCents - b.priceCents) / a.priceCents))`; `expect(qa).toBeLessThanOrEqual(10)`. With the seed (₹99 minimum, prices from ₹20) `qa` is 2 to 4.

Customer half (`page`, web origin). Locators: `banner = page.getByRole('banner')`, `drawer = page.getByRole('dialog', { name: 'Your cart', exact: true })`, `quantityOf(name) = page.getByRole('group', { name: 'Quantity of ' + name, exact: true })` (local arrow function), `search(name)`: fill `banner.getByRole('searchbox', { name: 'Search products' })` with the name and press Enter, then wait for the URL `/\/search\?q=/`.

1. `page.goto('/register')`, axe. Fill "Name" `E2E Flow Customer`, "Email" `freshEmail()` (kept as `email`), "Password" `password123`; click "Create account"; URL `/`.
2. The pincode sheet (`dialog` "Your delivery pincode") is open on Home with no stored pincode: axe; fill "Pincode" (`exact: true`) `560034`; click "Save pincode"; the sheet has count 0; `banner.getByRole('button', { name: 'Delivery in 10 minutes 560034', exact: true })` visible; axe.
3. Browse: `page.getByRole('region', { name: 'Shop by category' }).getByRole('link', { name: 'Dairy, Bread & Eggs' })` click; heading level 1 "Dairy, Bread & Eggs"; axe.
4. Add two: `search(a.name)`; click `Add ${a.name}` (`exact: true`); `quantityOf(a.name)` has text `1`; axe. `search(b.name)`; click `Add ${b.name}`; `quantityOf(b.name)` has text `1`.
5. Change a quantity: click `banner.getByRole('button', { name: /^2 items/ })`; in `drawer`, click `Add one ${a.name}` (`exact: true`) `qa - 1` times; `drawer.getByRole('group', { name: 'Quantity of ' + a.name, exact: true })` has text `String(qa)`; axe; click `drawer.getByRole('button', { name: 'Close', exact: true })`.
6. Sign out: click `banner.getByRole('link', { name: 'E2E Flow Customer' })` (the account link shows the name at desktop width); heading level 1 visible on `/account`; axe; click "Sign out" (`exact: true`); URL `/`; `banner.getByRole('button', { name: 'Cart', exact: true })` visible (the cart went with the session).
7. Sign in: click `banner.getByRole('link', { name: 'Sign in', exact: true })`; axe; fill "Email" `email`, "Password" `password123` (both `exact: true`); click "Sign in" (`exact: true`); URL `/`.
8. Merged cart: click `banner.getByRole('button', { name: new RegExp('^' + (qa + 1) + ' items') })`; `drawer.getByRole('listitem')` count 2; the drawer's quantity groups for `a` and `b` have texts `String(qa)` and `1`; axe; click `drawer.getByRole('link', { name: 'Proceed to checkout', exact: true })`; URL `/\/checkout$/`.
9. New address at checkout, as `checkout.spec.ts` › "address added at checkout" does it: region "Delivery address" → "Add address" → dialog "Add address": axe; "Label" `Home`, "Address line 1" `12 80 Feet Rd, Koramangala`, "Pincode" `560034` (all `exact: true`); "Save address"; dialog hidden; `Deliver to Home` has `aria-pressed` `true`; region "Order summary" shows `a.name` and `b.name`; axe.
10. Place: click "Place order (COD)" (`exact: true`); URL `/\/orders\/[0-9a-f-]{36}$/`; `const heading = page.getByRole('heading', { level: 1 })`; `await expect(heading).toHaveText(/^Order SS-\w{8}$/)`; `const number = (await heading.textContent())!.slice('Order '.length)`; text "Order placed. Waiting for the store to accept it." (`exact: true`) visible; axe. The page stays open on the tracking page from here on; nothing reloads it.

Staff half (a second context; `try { ... } finally { await staffContext.close() }`):

11. `const staffContext = await browser.newContext({ baseURL: adminOrigin })`; `const board = await staffContext.newPage()`; `staffSignIn(board, 'koramangala@shopperstop.local', 'staff12345')`.
12. `board.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Orders' })` click; text "Store: Koramangala" visible; `board.getByRole('region', { name: /^Placed/ }).getByRole('listitem').filter({ hasText: number })` visible; axe.
13. For `[button, status]` of `[['Accept', 'Accepted'], ['Start packing', 'Packing'], ['Mark ready', 'Ready'], ['Send out', 'Out for delivery']]`: click `${button} ${number}`; `board.getByRole('status').filter({ hasText: `${number} is now ${status}.` })` visible. After the loop: axe.
14. Click `Mark delivered ${number}`; `const confirm = board.getByRole('dialog', { name: `Mark ${number} delivered?` })`; axe; `confirm.getByRole('button', { name: 'Mark delivered' })` click; status `${number} is now Delivered.` visible; axe.

Back on `page`:

15. `page.getByText('Your order was delivered.', { exact: true })` visible with `{ timeout: 15_000 }` (the tracking poll is 10 s); `page.getByRole('region', { name: 'Status history', exact: true }).getByRole('listitem').last().getByText('Delivered', { exact: true })` visible; axe.

### Flow 2: test "admin product found by customer search"

Fixtures `{ page, browser }`. `const run = Date.now().toString(36)`; `const name = `Zzz E2E Paneer ${run}``.

1. `const adminContext = await browser.newContext({ baseURL: adminOrigin })`; `const admin = await adminContext.newPage()`; `try { ... } finally { await adminContext.close() }` around steps 1 to 3. `staffSignIn(admin, 'admin@shopperstop.local', 'admin12345')`.
2. Create, as `apps/admin/e2e/catalog.spec.ts` does: nav "Admin" → link "Products"; heading level 1 "Products"; link "New product"; fill "Name" `name`; "Category" `selectOption({ label: 'Dairy, Bread & Eggs › Paneer & Curd' })`; "Unit" `200 g`; "MRP (₹)" `90`; "Price (₹)" `85`; axe; "Create product"; heading level 1 `name` visible; axe.
3. Stock: `admin.goto(`./stock?store=${koramangala}`)`; searchbox "Search" fill `run`; button "Search" (`exact: true`); `admin.getByRole('textbox', { name: `Quantity of ${name}` })` has value `0`; axe; fill `5`; "Save changes"; status "Stock saved." visible; axe.
4. Customer: `page.addInitScript(() => localStorage.setItem('shopperstop:pincode', '560034'))`; `page.goto('/')`; fill banner searchbox "Search products" with `run`, Enter; URL `/\/search\?q=/`; `page.getByRole('link', { name: new RegExp(name) })` visible; `page.getByRole('button', { name: `Add ${name}`, exact: true })` visible; axe.

The product is left in place: `globalSetup` resets the seed at the start of every web run, and the admin suite (which counts 148 products) runs before the web suite and resets the seed itself.

## Decision 3: why these names and numbers

- The name starts with "Zzz" so it sorts after every seeded product (core lists by name; the last seeded name is "Zucchini"). A product sorting earlier would move one product from page 1 onto page 2 while other tests run `orderPick` (page 2) and `homePicks` (page 1) in parallel, so two tests could get the same product's stock. Stock 5 (not 10) keeps it out of `orderPick`'s filter even at the end of page 2.
- `run` (base-36 milliseconds) makes the name unique per run and is a search term only this product matches.
- Flow 1 adds through search, not from the category grid: the category page lists 24 per page by name and the picks sit on core's second page, so they may not be on the first screen of any category. The category visit stays as the "browse a category" step.

## Sign-ins per web run (core: 10 per email per hour per core process, 100 per IP)

| Email | Before | This change | After |
|---|---|---|---|
| admin@shopperstop.local | 3 by API (`cart.spec.ts`, `checkout.spec.ts`, `orders.spec.ts`), +1 when `browse.spec.ts` creates the closed store | +1 in the browser (Flow 2) | 4 to 5 |
| koramangala@shopperstop.local | 0 | +1 in the browser (Flow 1) | 1 |
| the flow's new customer | - | register (no sign-in) +1 sign-in | 1 |

Under `make e2e` the admin and web suites each start their own core (Playwright stops the admin suite's core on exit), so the counts do not add. Ceiling: with a core already running on 18080 and reused by both suites (`reuseExistingServer` outside CI), admin@ reaches about 7 + 5 = 12 in an hour and the later sign-ins answer 429; stop that core or wait an hour.

## Red and green

The pages exist, so the only missing piece is the admin origin. Commit order: `test: cross-app flows` (the spec file alone), then `feat: serve the admin preview in the web suite` (Decision 1).

- Worker, without Playwright: on the `test:` commit lint and typecheck of `apps/web` are green (the spec compiles against `shopper.ts`), and `grep -c 15174 apps/web/playwright.config.ts` prints `0`.
- Manager, red: on the `test:` commit, `make e2e` (or the web suite alone with `make -n e2e`'s environment after `npm run build --workspaces`). Expected: Flow 2 fails at its first step on `http://localhost:15174/admin/sign-in` (`net::ERR_CONNECTION_REFUSED`); Flow 1 passes steps 1 to 10 and fails at step 11 the same way. Every other test green (admin 14, web 40 passed, 2 failed).
- Manager, green: on the `feat:` commit, `make e2e`: admin 14, web 42.

## Tests

| Scenario | Test |
|---|---|
| Customer site end-to-end suite with axe › Customer smoke pages pass axe | `e2e/smoke.spec.ts` (unchanged) |
| Customer site end-to-end suite with axe › Admin preview served for the cross-app flows | `e2e/flows.spec.ts` › "admin product found by customer search" step 1 (and Flow 1 step 11) |
| Customer cross-app end-to-end flows › Customer order taken to delivered by store staff | `e2e/flows.spec.ts` › "customer order to delivered across both apps" |
| Customer cross-app end-to-end flows › Admin product found by customer search | `e2e/flows.spec.ts` › "admin product found by customer search" |

## Ceilings

- The red is the missing admin origin, not a page behaviour: the flows' assertions are characterization of pages already built and tested per app. A mutation check (for example a wrong expected status text) is the manager's call.
- Flow 1's "merged cart" is a signed-in cart restored at sign-in, as Spec 2 §13 orders the steps (add while signed in, then sign out and in); the guest-lines merge is `cart.spec.ts` › "guest cart merges against core".
- Desktop width only (1280 by Playwright's Desktop Chrome); the account link is found by the customer's name, which is screen-reader-only below 640 px.
- The flows depend on the admin app's visible names; a rename there breaks this suite and admin's own, in the same PR's `make e2e`.
- Flow 2's product stays until the next seed reset.

## Files

- `apps/web/playwright.config.ts` (one entry)
- `apps/web/e2e/flows.spec.ts` (new)
- `openspec/changes/web-e2e-flows/` (this change)
