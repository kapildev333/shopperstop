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

### Requirement: Customer session token
The customer site SHALL keep the session token returned by `POST /auth/sign-in` (or register) in memory and in `localStorage` under `shopperstop:customer-token`, SHALL read it from `localStorage` when the app loads, and SHALL attach it as `Authorization: Bearer <token>` to every core request while it is held. The token SHALL be removed from memory and `localStorage` on sign-out and when core answers any request with status 401. No cookie SHALL be set or read.

#### Scenario: Token persisted and cleared
- **WHEN** the session store is given the token `t-1` and later cleared
- **THEN** `localStorage` `shopperstop:customer-token` is `t-1` in between, and afterwards the key is absent and the store holds no token

#### Scenario: Token restored on load
- **WHEN** `localStorage` holds `shopperstop:customer-token` = `t-2` before the session store module loads
- **THEN** the store holds `t-2`

#### Scenario: Bearer attached
- **WHEN** the store holds `t-3` and the client's request middleware handles a request to `/api/core/v1/me`
- **THEN** the request carries the header `Authorization: Bearer t-3`

#### Scenario: Expired session dropped
- **WHEN** the store holds a token and the client's response middleware sees a 401 response
- **THEN** the store holds no token and `localStorage` has no `shopperstop:customer-token`

### Requirement: Customer sign-in and register forms
`/sign-in` SHALL show email and password, a "Sign in" button and a link to `/register`; `/register` SHALL show name, email and password, a "Create account" button and a link to `/sign-in`; both links SHALL keep `returnTo`. Before calling core the forms SHALL flag empty required fields and, on register, a password outside 8 to 72 bytes. An envelope error with a shown `field` SHALL render under that field; any other failure in an `ErrorBanner`.

#### Scenario: Required fields checked
- **WHEN** the sign-in form is submitted empty
- **THEN** "Enter your email" and "Enter your password" show under their fields and nothing is sent

#### Scenario: Short password on register
- **WHEN** the register form is submitted with a 7-character password
- **THEN** "Use 8 to 72 characters" shows under the password field and nothing is sent

#### Scenario: Field error from the envelope
- **WHEN** submitting the register form answers `{"error":{"code":"conflict","message":"Email already registered","field":"email"}}`
- **THEN** "Email already registered" shows under the email field and the email input is `aria-invalid`

#### Scenario: Non-field error in a banner
- **WHEN** submitting the sign-in form answers `{"error":{"code":"unauthorized","message":"Wrong email or password"}}`
- **THEN** an alert shows "Wrong email or password"

### Requirement: Customer return after sign-in
On a successful sign-in or register the site SHALL store the session token and navigate to `returnTo` when it is a same-origin path (starts with one `/`, not `//`), otherwise to `/`.

#### Scenario: Unsafe returnTo ignored
- **WHEN** `returnTo` is `https://evil.example/`, `//evil.example/` or absent
- **THEN** the destination after sign-in is `/`; for `/account?tab=1` it is `/account?tab=1`

#### Scenario: Register signs in
- **WHEN** a browser registers a new email on `/register`
- **THEN** it lands on `/`, `localStorage` holds `shopperstop:customer-token`, and axe reports no violations on `/register`, including with a field error showing

#### Scenario: Demo customer signs in
- **WHEN** a browser signs in on `/sign-in` as the demo customer `demo@shopperstop.local`
- **THEN** it lands on `/`, `localStorage` holds `shopperstop:customer-token`, and axe reports no violations on `/sign-in`

#### Scenario: Wrong password against core
- **WHEN** a browser signs in on `/sign-in` with an unregistered email
- **THEN** an alert shows core's message, the URL stays on `/sign-in`, and no token is stored

#### Scenario: Sign in returns to where the customer was
- **WHEN** a signed-out browser opens `/account`, is sent to `/sign-in`, and signs in
- **THEN** it lands on `/account` with the level-1 heading "Your account"

### Requirement: Customer header account control
The banner SHALL hold, after the pincode control, a "Sign in" link to `/sign-in?returnTo=<current path and search>` when no token is held, and a link to `/account` named with the customer's name from `GET /me` when signed in ("Account" while it loads).

#### Scenario: Signed-out header
- **WHEN** the app renders `/` with no token
- **THEN** the banner holds a "Sign in" link whose `href` is `/sign-in?returnTo=%2F`

#### Scenario: Signed-in header
- **WHEN** a customer named "E2E Shopper" is signed in and opens `/`
- **THEN** the banner holds a link named "E2E Shopper" pointing to `/account`

### Requirement: Customer account page requires sign-in
`/account` SHALL, whenever no token is held (on first render or after the token is dropped), replace itself with `/sign-in?returnTo=%2Faccount`.

#### Scenario: Signed-out account redirect
- **WHEN** the app renders `/account` with no token
- **THEN** the location becomes `/sign-in?returnTo=%2Faccount` and the level-1 heading is "Sign in"

### Requirement: Customer address dialog
Adding and editing an address SHALL use one dialog titled "Add address" or "Edit address" with label, line 1, line 2 (optional) and pincode, Cancel first in the footer, a field error for an empty required field and for a pincode that is not exactly six digits, and envelope field errors under their fields as on the sign-in forms; the dialog SHALL close only on success.

#### Scenario: Address dialog checks fields
- **WHEN** the add-address dialog is saved with line 1 empty and pincode `5600`
- **THEN** "Enter the first address line" and "Enter a 6-digit pincode" show under their fields and nothing is sent

#### Scenario: Address dialog shows envelope field error
- **WHEN** saving the dialog answers `{"error":{"code":"validation","message":"Pincode is not valid","field":"pincode"}}`
- **THEN** "Pincode is not valid" shows under the pincode field and the dialog stays open

#### Scenario: Edit dialog prefilled
- **WHEN** the dialog opens for an existing address labelled "Home" with pincode `560001`
- **THEN** its title is "Edit address", the label input holds "Home" and the pincode input holds `560001`, and the first footer button is "Cancel"

### Requirement: Customer profile and sign out
`/account` SHALL show the level-1 heading "Your account", a profile card with name and phone prefilled from `GET /me` and a "Save" button that sends `PATCH /me` and then shows "Saved", and a "Sign out" button that calls `POST /auth/sign-out`, drops the token and cached data, and navigates to `/`.

#### Scenario: Profile saved
- **WHEN** a newly registered customer on `/account` enters phone `9876543210` and chooses "Save"
- **THEN** "Saved" shows and after a reload the phone input holds `9876543210`

#### Scenario: Sign out
- **WHEN** a signed-in customer chooses "Sign out" on `/account`
- **THEN** the browser is on `/`, the banner holds "Sign in", `localStorage` has no `shopperstop:customer-token`, and opening `/account` lands on `/sign-in`

### Requirement: Customer address list
The account page SHALL list `GET /me/addresses` with label, lines and pincode, a "Default" badge on the default address, per address "Edit", "Set as default" (not on the default) and "Delete", an "Add address" button, and the empty state "No addresses yet" when there are none.

#### Scenario: Addresses and default
- **WHEN** a newly registered customer on `/account` sees "No addresses yet", adds addresses "Home" and "Work" through the dialog, and chooses "Set as default" on "Home" and then on "Work"
- **THEN** both addresses are listed, "Work" carries the only "Default" badge after a reload, and axe reports no violations on `/account` and on the open dialog

#### Scenario: Address edited and deleted
- **WHEN** the customer edits "Home" to line 1 "2 New Road" and then deletes "Work"
- **THEN** only "Home" is listed, showing "2 New Road"
