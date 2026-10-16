## ADDED Requirements

### Requirement: Mobile workspace gates
`apps/mobile` SHALL be an npm workspace whose `lint`, `typecheck`, `test` and `build` scripts pass under `make test-web` unchanged: `test` SHALL run Jest and ignore any extra arguments the root passes, and `build` SHALL write the static web export of the app into `apps/mobile/dist`.

#### Scenario: Root test arguments ignored
- **WHEN** `npm run test --workspace apps/mobile -- --run` runs
- **THEN** Jest runs the app's suite and the command exits 0

#### Scenario: Web export built
- **WHEN** `npm run build --workspace apps/mobile` runs
- **THEN** it exits 0 and `apps/mobile/dist` holds `index.html`, `sign-in.html`, `register.html` and `account.html`

### Requirement: Mobile colours only from tokens
Every colour in `apps/mobile/src` SHALL come from `src/ui/tokens.ts`, which re-exports the values of `@shopperstop/ui/tokens`; no source file SHALL hold a hex colour, a colour function or a quoted CSS colour name.

#### Scenario: No literal colours in the app
- **WHEN** the app's `no-literal-colors` test scans `apps/mobile/src`
- **THEN** it finds no hex colour, colour function or quoted colour name such as `'white'`, and the same scanner does find `#fff`, `rgba(0,0,0,0.5)` and `'white'` in a sample text

### Requirement: Mobile client reaches core
The app SHALL call core at `<EXPO_PUBLIC_CORE_URL>/api/core/v1`, with `http://localhost:8080` when the variable is unset at build time.

#### Scenario: Default core URL
- **WHEN** the app is built without `EXPO_PUBLIC_CORE_URL` and the client sends `GET /me`
- **THEN** the request URL is `http://localhost:8080/api/core/v1/me`

### Requirement: Mobile session token
The app SHALL keep the customer token from sign-in or register in memory and in the device's secure store under `shopperstop.customer-token` (the browser's `localStorage`, same key, on the web export), SHALL read it when the app loads, attach it as `Authorization: Bearer <token>` to every core request while held, and remove it on sign-out. No cookie SHALL be used.

#### Scenario: Token persisted and cleared
- **WHEN** the session store is given the token `t-1` and later cleared
- **THEN** the secure store holds `shopperstop.customer-token` = `t-1` in between, and afterwards the key is absent and the session store holds no token

#### Scenario: Token restored on load
- **WHEN** the secure store holds `shopperstop.customer-token` = `t-2` before the session module loads
- **THEN** the session store holds `t-2`

#### Scenario: Bearer attached
- **WHEN** the session store holds `t-3` and the client sends `GET /me`
- **THEN** the request carries the header `Authorization: Bearer t-3`

### Requirement: Mobile lost session
When core answers 401 to a request that carried the current token, the app SHALL remove the token from memory and the secure store. A 401 to a request sent without a token, or with a token since replaced, SHALL leave the held token alone.

#### Scenario: 401 to the current token
- **WHEN** the store holds `t-4` and a request sent with `t-4` is answered 401
- **THEN** the store holds no token and the secure store has no `shopperstop.customer-token`

#### Scenario: 401 without a token keeps a new session
- **WHEN** a request sent without a token is answered 401 after the token `fresh` was stored meanwhile
- **THEN** the store still holds `fresh`

#### Scenario: 401 to a replaced token keeps the new session
- **WHEN** a request sent with `old` is answered 401 after the token `new` was stored meanwhile
- **THEN** the store still holds `new` in memory and in the secure store

### Requirement: Mobile failed answers without the error envelope
The client SHALL treat every answer with a status outside 200 to 299 as a failure. When such a body is not core's envelope (`error.code` and `error.message`, both strings), the client SHALL hand on the same status with `{"error":{"code":"internal","message":"Could not reach ShopperStop. Try again."}}`. Enveloped failures and every 2xx answer SHALL pass unchanged.

#### Scenario: Empty failed answer becomes internal
- **WHEN** core's answer to `GET /me` is 502 with an empty body
- **THEN** the caller gets status 502 and the error `{"code":"internal","message":"Could not reach ShopperStop. Try again."}`

#### Scenario: HTML failed answer becomes internal
- **WHEN** the answer is 502 with the body `<html><body>Bad Gateway</body></html>`
- **THEN** the caller gets status 502 and the `internal` error

#### Scenario: Enveloped failure passes through
- **WHEN** the answer is 409 with `{"error":{"code":"conflict","message":"Email already registered","field":"email"}}`
- **THEN** the caller gets exactly that code, message and field

#### Scenario: Bare 401 ends the session and becomes internal
- **WHEN** the store holds `t-5` and a request sent with `t-5` is answered 401 with no body
- **THEN** the store holds no token and the caller gets status 401 and the `internal` error

#### Scenario: No content answer untouched
- **WHEN** `DELETE /me/addresses/{id}` is answered 204
- **THEN** the caller gets no error

#### Scenario: Failed write reports an error
- **WHEN** `PATCH /me` is answered 502 with an empty body and the request runs through `call()`
- **THEN** `call()` resolves to the `internal` error, not to `undefined`

#### Scenario: Unreachable core reports an error
- **WHEN** the network refuses `POST /auth/sign-in` and the request runs through `call()`
- **THEN** `call()` resolves to the `internal` error

### Requirement: Mobile bottom tabs
The app SHALL open on a tab layout with the tabs Home, Categories and Orders in that order, each a Lucide icon over its label, the current tab in `accent`. Home SHALL show a `brand` header holding the level-1 heading "Groceries in minutes" and an icon button "Account" that opens `/account`. Categories and Orders SHALL show an empty state until their lanes fill them.

#### Scenario: Home in the tabs
- **WHEN** the app renders `/`
- **THEN** the tabs Home, Categories and Orders are shown in that order with Home selected, the heading "Groceries in minutes" is shown, and an "Account" button is shown

#### Scenario: Tab switch
- **WHEN** the customer on `/` chooses the Orders tab
- **THEN** the Orders tab is selected and the Home heading is no longer shown

#### Scenario: Account button opens the account
- **WHEN** a signed-in customer on `/` chooses "Account"
- **THEN** the "My account" screen is shown

### Requirement: Mobile not found
A path no route matches SHALL show the level-1 heading "Page not found" and a "Go to Home" link to `/`.

#### Scenario: Unknown path
- **WHEN** the app renders `/nope`
- **THEN** the heading "Page not found" and a "Go to Home" link are shown, and choosing the link shows the Home heading

### Requirement: Mobile sign-in and register screens
`/sign-in` SHALL show a `brand` header with a "Back" button and the heading "Sign in", the fields Email and Password with a "Show password" toggle, a "Sign in" button and a "Create an account" link to `/register`; `/register` SHALL show "Create account" with Name, Email and Password, a "Create account" button and a "Sign in" link. Both links SHALL keep `returnTo`.

#### Scenario: Sign-in screen
- **WHEN** the app renders `/sign-in?returnTo=%2Faccount`
- **THEN** the heading "Sign in", the Email and Password inputs, a "Sign in" button and a "Create an account" link are shown, and choosing the link shows "Create account" with `returnTo` still `/account`

#### Scenario: Password shown on request
- **WHEN** the customer types into Password and chooses "Show password"
- **THEN** the Password input no longer hides its text and the toggle is now named "Hide password"

### Requirement: Mobile forms submit from Password
Submitting from the Password input of sign-in or register (Enter on the web export, the keyboard's Go key on a device) SHALL submit the form as its button does.

#### Scenario: Enter in Password submits
- **WHEN** the customer fills the sign-in or the register form and submits from the Password input
- **THEN** exactly one `POST /auth/sign-in` or `POST /auth/register` is sent and its answer is shown

### Requirement: Mobile sign-in and register checks
Before calling core, the screens SHALL show "Enter your name", "Enter your email" or "Enter your password" under an empty required field and, on register, "Use 8 to 72 characters" for a password outside 8 to 72 bytes. An envelope error naming a shown field SHALL show under that field; any other failure SHALL show in an alert above the form.

#### Scenario: Required fields checked
- **WHEN** the sign-in form is submitted empty
- **THEN** "Enter your email" and "Enter your password" show under their fields and no request is sent

#### Scenario: Short password on register
- **WHEN** the register form is submitted with a name, an email and a 7-character password
- **THEN** "Use 8 to 72 characters" shows under Password and no request is sent

#### Scenario: Field error from the envelope
- **WHEN** submitting the register form is answered 409 `{"error":{"code":"conflict","message":"Email already registered","field":"email"}}`
- **THEN** "Email already registered" shows under Email and no alert is shown

#### Scenario: Non-field error in an alert
- **WHEN** submitting the sign-in form is answered 401 `{"error":{"code":"unauthorized","message":"Wrong email or password"}}`
- **THEN** an alert shows "Wrong email or password" and no token is stored

### Requirement: Mobile return after sign-in
On a successful sign-in or register the app SHALL store the token, keep the customer from the answer as the signed-in customer, and replace the screen with `returnTo` when it starts with one `/` (not `//` or `/\`), otherwise with `/`. `/account` SHALL, whenever no token is held, replace itself with `/sign-in?returnTo=%2Faccount`.

#### Scenario: Unsafe returnTo ignored
- **WHEN** `returnTo` is `https://evil.example/`, `//evil.example/`, `/\evil.example` or absent
- **THEN** the destination after sign-in is `/`; for `/account` it is `/account`

#### Scenario: Signed-out account redirect
- **WHEN** the app renders `/account` with no token
- **THEN** the "Sign in" screen is shown with `returnTo` `/account`

#### Scenario: Sign in returns to the account
- **WHEN** a signed-out customer opens `/account`, is sent to sign in, and core answers the sign-in 200 with a session
- **THEN** the "My account" screen is shown and the token is held

#### Scenario: Register lands on Home
- **WHEN** the register form with no `returnTo` is answered 201 with a session
- **THEN** the app is on `/` and the token is held

### Requirement: Mobile account screen
`/account` SHALL show a header with a "Back" button and the level-1 heading "My account", a profile card with the customer's initial, name, email and phone (when set) and an "Edit profile" button, a "Your orders" link to the Orders tab, the saved addresses card, and a "Sign out" button that calls `POST /auth/sign-out`, drops the token and cached data, and shows Home.

#### Scenario: Profile shown
- **WHEN** a signed-in customer "Asha Rao" with email `asha@example.com` and phone `9876543210` opens `/account`
- **THEN** "My account", "Asha Rao", `asha@example.com` and `9876543210` are shown

#### Scenario: Sign out
- **WHEN** a signed-in customer chooses "Sign out"
- **THEN** `POST /auth/sign-out` was sent, the store holds no token, and the Home heading is shown

### Requirement: Mobile edit profile sheet
"Edit profile" SHALL open a sheet titled "Edit profile" with Name and Phone (optional) prefilled from the customer and a "Save" button that sends `PATCH /me` with both and closes the sheet on success. An empty name SHALL show "Enter your name" and send nothing; an envelope error naming `name` or `phone` SHALL show under that field and keep the sheet open.

#### Scenario: Profile saved
- **WHEN** the customer enters phone `9876543210` in "Edit profile" and chooses "Save", and core answers 200 with that phone
- **THEN** `PATCH /me` carried `{"name":"Asha Rao","phone":"9876543210"}`, the sheet is closed, and the profile card shows `9876543210`

#### Scenario: Bad phone from the envelope
- **WHEN** saving is answered 400 `{"error":{"code":"validation","message":"Phone is not valid","field":"phone"}}`
- **THEN** "Phone is not valid" shows under Phone and the sheet stays open

### Requirement: Mobile saved addresses
The account screen SHALL list `GET /me/addresses` under "Saved addresses", each with its label, a "Default" badge on the default, the lines and pincode joined by commas, and the actions "Edit", "Set as default" (not on the default, sends `PATCH` with `isDefault` true) and "Delete" (sends `DELETE`), each named with the address label for assistive technology; an "Add address" button; and "No saved addresses. Add one to check out faster." when there are none.

#### Scenario: Addresses and default
- **WHEN** the customer has "Home" (default) and "Work", and chooses "Set as default" on "Work", and core then lists Work as the default
- **THEN** `PATCH /me/addresses/<Work id>` carried `{"isDefault":true}` and "Work" carries the only "Default" badge

#### Scenario: Address deleted
- **WHEN** the customer chooses "Delete" on "Work" and core answers 204, then lists only "Home"
- **THEN** `DELETE /me/addresses/<Work id>` was sent and only "Home" is listed

#### Scenario: No addresses
- **WHEN** core lists no addresses
- **THEN** "No saved addresses. Add one to check out faster." and an "Add address" button are shown

### Requirement: Mobile address row actions sent once
While an address row action is waiting for core, the row actions SHALL be disabled, so a second tap sends nothing, also when both taps fall in the same tick. A row action that fails, also by throwing, SHALL re-enable the row actions.

#### Scenario: Row action not sent twice
- **WHEN** the customer chooses "Set as default" or "Delete" on "Work" twice before core answers the first
- **THEN** one `PATCH` or one `DELETE` was sent

#### Scenario: Failed row action re-enables the rows
- **WHEN** the customer chooses "Set as default" on "Work" and the network refuses the `PATCH`
- **THEN** "Could not reach ShopperStop. Try again." is shown and "Set Work as default" and "Delete Work" are enabled again

### Requirement: Mobile address sheet
Adding and editing SHALL use one sheet titled "Add address" or "Edit address" with "Save as" chips Home, Work and Other (plus the address's own label when it is none of these), "House, flat, floor", "Street and area" (optional), "Pincode", a "Make this my default address" switch that announces its on or off state, and "Save address", which sends `POST /me/addresses` or `PATCH /me/addresses/{id}` and closes the sheet only on success.

#### Scenario: Address added
- **WHEN** the customer chooses the "Work" chip, enters `1 Park St` and `560038`, turns on the default switch and saves, and core answers 201
- **THEN** `POST /me/addresses` carried `{"label":"Work","line1":"1 Park St","pincode":"560038","isDefault":true}` and the sheet is closed

#### Scenario: Edit sheet prefilled
- **WHEN** the sheet opens for the address "Gym", `5 Lake Rd`, `560001`, not default
- **THEN** the title is "Edit address", the "Gym" chip is selected, the inputs hold `5 Lake Rd` and `560001`, the switch is off, and saving sends `PATCH /me/addresses/<id>`

#### Scenario: Default switch reports its state
- **WHEN** the "Make this my default address" switch is off and the customer chooses it
- **THEN** it is found by the role switch and its label, its state is checked false before the press, and the sheet is told it is now on

#### Scenario: Space flips the switch
- **WHEN** the "Make this my default address" switch is off and has focus on the web export, and the customer presses Space
- **THEN** the sheet is told it is now on, the page does not scroll, and Enter is left to the switch's own press

### Requirement: Mobile address sheet checks
The address sheet SHALL show "Enter house, flat or floor" for an empty first line and "Enter a 6-digit pincode" unless the pincode is six digits, and send nothing then; an envelope error naming `label`, `line1`, `line2` or `pincode` SHALL show under that field and keep the sheet open; any other failure SHALL show in an alert inside the sheet.

#### Scenario: Address sheet checks fields
- **WHEN** the add sheet is saved with "House, flat, floor" empty and pincode `5600`
- **THEN** "Enter house, flat or floor" and "Enter a 6-digit pincode" show and no request is sent

#### Scenario: Envelope field error in the sheet
- **WHEN** saving is answered 400 `{"error":{"code":"validation","message":"Pincode is not valid","field":"pincode"}}`
- **THEN** "Pincode is not valid" shows under Pincode and the sheet stays open

### Requirement: Mobile sheets
A sheet SHALL open as a modal from the bottom of the screen on a dimmed backdrop, with its title as a heading and a "Close" icon button, and SHALL be a dialog named by its title. Its content SHALL scroll inside the sheet once it is taller than 80% of the window. The close button, a tap on the backdrop, the Android back gesture and Escape on the web export SHALL each close it.

#### Scenario: Sheet closed
- **WHEN** a sheet titled "Edit profile" is open and the customer chooses "Close", or the platform asks the modal to close
- **THEN** the sheet's title is no longer shown

#### Scenario: Sheet content scrolls
- **WHEN** a sheet titled "Add address" is open
- **THEN** its content sits in a scroll view that keeps taps while the keyboard is up

#### Scenario: Sheet dialog named by its title
- **WHEN** a sheet titled "Add address" is open
- **THEN** its modal carries the name "Add address"

### Requirement: Mobile document titles
Every page of the web export SHALL carry `<title>ShopperStop</title>` and `<html lang="en">` in its static shell, and each screen SHALL set the document title to "<screen> · ShopperStop" when it renders.

#### Scenario: Static shell title
- **WHEN** the static shell of the export is rendered with no screen
- **THEN** the markup holds `<title>ShopperStop</title>` and `<html lang="en">`

#### Scenario: Screen title
- **WHEN** a browser on the web export is sent from `/account` to the sign-in screen
- **THEN** the document title is "Sign in · ShopperStop"

### Requirement: Mobile screens keep data when a refetch fails
Every screen that shows a read from core SHALL show a skeleton labelled "Loading" while it holds no answer and no error, an error state while it holds no answer and the read failed, and otherwise the last answer it holds, also when a later read fails. The error state SHALL be an alert titled "You're offline" (core unreachable) or "Something went wrong on our side" (core answered a failure) with a "Try again" button that repeats the read.

#### Scenario: Loading account
- **WHEN** a signed-in customer opens `/account` and core has not answered `GET /me` yet
- **THEN** an element labelled "Loading" is shown and no profile is shown

#### Scenario: Core unreachable with nothing held
- **WHEN** a signed-in customer opens `/account` and the network refuses `GET /me`
- **THEN** an alert "You're offline" with "Check your connection and try again." and a "Try again" button is shown, and choosing it after core answers shows the profile

#### Scenario: Core failure with nothing held
- **WHEN** `GET /me/addresses` is answered 500 with an envelope
- **THEN** the addresses card shows the alert "Something went wrong on our side" with "Please try again in a moment." and a "Try again" button

#### Scenario: Failed refetch keeps the account
- **WHEN** the profile and addresses were read more than 60 seconds ago, the customer opens `/account`, and both reads it repeats fail because core cannot be reached
- **THEN** the name and the addresses are still shown and no alert is shown

### Requirement: Mobile end-to-end suite with axe
`npm run e2e` in `apps/mobile` SHALL export the web build against `http://localhost:18080`, serve it on port 15176, start core from `services/core` with the environment it is given, and run Playwright on Chromium at 390×844, running `@axe-core/playwright` on every screen it visits and failing on any violation.

#### Scenario: Demo customer signs in
- **WHEN** a browser opens `/account`, is sent to sign in, and signs in as `demo@shopperstop.local` with `demo12345`
- **THEN** "My account" is shown, `localStorage` holds `shopperstop.customer-token`, and axe reports no violations on the sign-in screen and the account screen

#### Scenario: Register with a field error
- **WHEN** a browser registers `demo@shopperstop.local` on `/register`, sees core's "email already registered" under Email, then registers a new email
- **THEN** axe reports no violations with the field error showing, and the browser ends on `/` with the heading "Groceries in minutes"

#### Scenario: Addresses against core
- **WHEN** a newly registered customer on `/account` sees "No saved addresses. Add one to check out faster.", adds "Home" and "Work" through the sheet, and chooses "Set as default" on "Work"
- **THEN** after a reload "Work" carries the only "Default" badge, and axe reports no violations on the account screen and on the open sheet

#### Scenario: Sign out against core
- **WHEN** a signed-in customer chooses "Sign out" on `/account`
- **THEN** the browser is on `/`, `localStorage` has no `shopperstop.customer-token`, and opening `/account` shows the sign-in screen
