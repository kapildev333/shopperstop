## MODIFIED Requirements

### Requirement: Admin shell
Every admin page SHALL render inside a shell made of a banner holding the brand band with the "ShopperStop Admin" wordmark and a main region holding the page; the page title SHALL be the only level-1 heading. While a staff member is signed in and a protected page is shown, the banner SHALL also show the staff member's name, a "Sign out" button, and a navigation landmark named "Admin" on a `surface` strip holding the links the staff member's role can reach (see "Role-based navigation"), the link to the current section carrying `aria-current="page"`. The sign-in page and the not-found page shown to a signed-out visitor SHALL have no navigation landmark. The index route `/` SHALL be the Dashboard page.

#### Scenario: Dashboard renders in the shell
- **WHEN** an admin with a valid session opens `/`
- **THEN** the banner contains "ShopperStop Admin", the admin's name and a "Sign out" button, the navigation landmark "Admin" holds a "Dashboard" link with `aria-current="page"`, and "Dashboard" is the only level-1 heading

#### Scenario: Current section stays marked on a sub-page
- **WHEN** an admin with a valid session opens `/stores`
- **THEN** the "Stores" link carries `aria-current="page"` and the "Dashboard" link does not

### Requirement: Served under /admin/
The built app SHALL be served under the `/admin/` path prefix, with its asset URLs and router paths under that prefix, so the same build works behind `vite preview` and behind Caddy's `/admin/*` route.

#### Scenario: Built app opens under the prefix
- **WHEN** a browser with no session opens `http://localhost:15174/admin/` on the `vite preview` server of the built app
- **THEN** it lands on `/admin/sign-in?redirect=%2F` with the page's styles applied, and after signing in the "Dashboard" link points to `/admin/`

### Requirement: Core reached through a same-origin proxy
The app SHALL call the core service only through one shared client whose base URL is the page's own origin followed by `/api/core/v1`, so every call is same-origin; the dev server SHALL proxy `/api` to `http://localhost:8080` and the preview server SHALL proxy `/api` to `http://localhost:18080`.

#### Scenario: Preview proxies to core
- **WHEN** core runs on port 18080 and a client requests `http://localhost:15174/api/core/v1/healthz`
- **THEN** the response is 200 with body `{"status":"ok"}`

#### Scenario: Client calls the page's origin
- **WHEN** the shared client sends `GET /admin/me` from a page served at origin `O`
- **THEN** the request URL is `O/api/core/v1/admin/me`

### Requirement: End-to-end suite with axe
`npm run e2e` in `apps/admin` SHALL run Playwright on Chromium only, starting core from `services/core` with the environment it is given and `vite preview` on port 15174, SHALL run `core-admin migrate` and `core-admin seed-demo --reset` from `services/core` with that environment before any test, and SHALL run `@axe-core/playwright` on every page it visits, failing on any violation.

#### Scenario: Smoke pages pass axe
- **WHEN** `make e2e` runs the admin suite
- **THEN** the sign-in page, the Dashboard, the not-found page and the sign-in page after sign-out are each visited and axe reports no violations on any of them

#### Scenario: Suite seeds its own data
- **WHEN** `npm run e2e --workspace apps/admin` runs against an e2e database that has never been seeded, with the `make e2e` environment exported
- **THEN** the seeded admin can sign in during the suite

## ADDED Requirements

### Requirement: Staff sign-in
The app SHALL serve `/sign-in` without a session, with labelled "Email" and "Password" fields and a "Sign in" button. It SHALL send no request while a field is empty, keep the button disabled while `POST /admin/auth/sign-in` is pending, and on success store the token and open the `redirect` query path, or `/` without one. A `redirect` not starting with a single `/` SHALL be ignored.

#### Scenario: Sign-in form is labelled
- **WHEN** a visitor opens `/sign-in`
- **THEN** "Sign in" is the only level-1 heading, the "Email" field has type `email`, the "Password" field has type `password`, and there is no "Admin" navigation landmark

#### Scenario: Empty fields are flagged
- **WHEN** the visitor submits the form with both fields empty
- **THEN** the "Email" field is described by "Enter your email.", the "Password" field by "Enter your password.", and no request is sent

#### Scenario: Submit disabled while pending
- **WHEN** the visitor submits valid fields and core has not answered yet
- **THEN** the "Sign in" button is disabled, and it is enabled again once core answers with an error

#### Scenario: Return to the page after sign-in
- **WHEN** the visitor signs in successfully at `/sign-in?redirect=%2Fstock`
- **THEN** the Stock page opens at `/stock`, the token is stored under `shopperstop:staff-token`, and no extra `GET /admin/me` is sent

#### Scenario: Outside redirect ignored
- **WHEN** the visitor signs in successfully at `/sign-in?redirect=%2F%2Fevil.example`
- **THEN** the Dashboard opens at `/`

### Requirement: Sign-in errors
A failed sign-in SHALL keep the user on `/sign-in` with no session and SHALL explain the failure: an alert naming the cause for `unauthorized` (wrong email or password, or an inactive account: core answers both alike), `rate_limited` and a request that got no answer; the message on the field for a `validation` error whose `field` is `email` or `password`; and the alert "Something went wrong. Try again." for any other error.

#### Scenario: Wrong credentials or inactive staff
- **WHEN** core answers the sign-in with 401 `unauthorized`
- **THEN** an alert shows "Email or password is wrong, or the account is inactive." and no token is stored

#### Scenario: Rate limited
- **WHEN** core answers the sign-in with 429 `rate_limited`
- **THEN** an alert shows "Too many sign-in attempts. Try again later." and no token is stored

#### Scenario: Core unreachable
- **WHEN** the sign-in request fails without an answer
- **THEN** an alert shows "Could not reach the server. Check your connection and try again." and no token is stored

#### Scenario: Any other error
- **WHEN** core answers the sign-in with 500 `internal`
- **THEN** an alert shows "Something went wrong. Try again." and no token is stored

#### Scenario: Field validation from core
- **WHEN** core answers 400 `validation` with `field` `email` and message "must be a valid email address"
- **THEN** the "Email" field is described by "must be a valid email address"

### Requirement: Staff session
The app SHALL keep the staff token in memory and in `localStorage` under `shopperstop:staff-token` (in memory only when storage is blocked), SHALL send it as `Authorization: Bearer <token>` on every core request while it exists, and on load with a stored token SHALL restore the staff member with `GET /admin/me` before showing a protected page.

#### Scenario: Token kept in memory and storage
- **WHEN** a session is stored with token `t1`
- **THEN** the app's token is `t1` and `localStorage` `shopperstop:staff-token` is `t1`

#### Scenario: Token survives a reload
- **WHEN** the app starts with `shopperstop:staff-token` set to `t2` in `localStorage`
- **THEN** the app's token is `t2`

#### Scenario: Blocked storage keeps the token in memory
- **WHEN** `localStorage` throws on every access and a session is stored with token `t4`
- **THEN** nothing throws and the app's token is `t4` until it is cleared

#### Scenario: Bearer token attached
- **WHEN** the app calls core with token `tok` stored
- **THEN** the request carries `Authorization: Bearer tok`

### Requirement: Lost session
When a core request that carried the current token is answered 401, the app SHALL remove the token from memory and storage and show `/sign-in?redirect=<current path>`. When `GET /admin/me` fails with anything other than 401 or 403 (see "Wrong-role deep link shows not found"), the app SHALL keep the token and show the alert "Could not reach the server." with a "Try again" button.

#### Scenario: 401 clears the session
- **WHEN** a request that carried a token is answered 401
- **THEN** the token is removed from memory and `localStorage`, and the session-lost handler runs

#### Scenario: 401 without a session changes nothing
- **WHEN** a request sent without a token is answered 401 after a session with token `fresh` was stored meanwhile
- **THEN** the token is still `fresh` and the session-lost handler does not run

#### Scenario: 401 to a replaced token keeps the new session
- **WHEN** a request sent with token `old` is answered 401 after token `new` was stored meanwhile
- **THEN** the token is still `new` in memory and `localStorage`, and the session-lost handler does not run

#### Scenario: Expired session on load
- **WHEN** the app opens `/orders` with a stored token and core answers `GET /admin/me` with 401
- **THEN** the sign-in page shows with `redirect` `/orders` and the token is gone

#### Scenario: Core unreachable on load
- **WHEN** the app opens `/` with a stored token and core answers `GET /admin/me` with 500
- **THEN** an alert shows "Could not reach the server." with a "Try again" button and the token is kept

### Requirement: Protected routes
Every route except `/sign-in` and the not-found page SHALL require a session. Without a stored token the app SHALL send no request and show `/sign-in?redirect=<path>`, where `<path>` is the requested path inside the app.

#### Scenario: Signed-out deep link
- **WHEN** a visitor with no session opens `/stock`
- **THEN** the sign-in page shows at `/sign-in` with `redirect` `/stock`, and no request reached core

#### Scenario: Unknown path signed out
- **WHEN** a visitor with no session opens `/nope`
- **THEN** "Page not found" is the level-1 heading inside the banner, with no redirect

### Requirement: Role-based navigation
The "Admin" navigation SHALL show only the sections the signed-in role can reach, in this order: for `admin`, Dashboard, Orders, Stock, Stores, Categories, Products, Staff; for `store_staff`, Dashboard, Orders, Stock.

#### Scenario: Admin sees every section
- **WHEN** an admin with a valid session opens `/`
- **THEN** the "Admin" navigation links are Dashboard, Orders, Stock, Stores, Categories, Products, Staff in that order

#### Scenario: Store staff see their sections
- **WHEN** a store staff member with a valid session opens `/`
- **THEN** the "Admin" navigation links are Dashboard, Orders, Stock in that order

### Requirement: Wrong-role deep link shows not found
When a store staff member opens an admin-only path (`/stores`, `/categories`, `/products`, `/staff` and the paths under them), the app SHALL stay on that path and show the not-found page inside the shell, never the admin page and never a redirect. A 403 `forbidden` from core on any request SHALL show the same not-found page and keep the session. The not-found page SHALL show "Page not found" as the level-1 heading and a card with a "Go to Dashboard" link.

#### Scenario: Store staff open an admin page
- **WHEN** a store staff member with a valid session opens `/stores`
- **THEN** "Page not found" is the level-1 heading, the "Admin" navigation is present, and the path is still `/stores`

#### Scenario: A 403 from core shows not found
- **WHEN** the app opens `/stock` with a stored token and core answers 403 `forbidden`
- **THEN** "Page not found" is the level-1 heading inside the banner, the path is still `/stock`, the sign-in page is not shown and the token is kept

#### Scenario: Admin opens an admin page
- **WHEN** an admin with a valid session opens `/stores`
- **THEN** "Stores" is the level-1 heading

### Requirement: Sign-out
The "Sign out" button SHALL send `POST /admin/auth/sign-out` with the token, then, whatever core answers, remove the token from memory and storage, forget the signed-in staff member and show `/sign-in` without navigation.

#### Scenario: Sign out ends the session
- **WHEN** a signed-in admin presses "Sign out"
- **THEN** `POST /admin/auth/sign-out` was sent with the bearer token, the sign-in page shows at `/sign-in`, `shopperstop:staff-token` is gone, and there is no "Admin" navigation

#### Scenario: Sign in, dashboard, sign out against core
- **WHEN** the e2e suite opens `/admin/`, signs in as the seeded admin, reloads the Dashboard and presses "Sign out"
- **THEN** the Dashboard shows all seven sections before and after the reload, and after sign-out the sign-in page shows and `shopperstop:staff-token` is gone
