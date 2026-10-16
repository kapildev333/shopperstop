# mobile-app Specification

## Purpose
The customer mobile app (`apps/mobile`, Expo and React Native): its workspace gates, how it reaches the core service and keeps the customer session, its React Native primitives and navigation, and the customer screens it mirrors from `web-app` where its behaviour differs (sheets, storage, navigation).

## Requirements

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

### Requirement: Mobile build profiles
`apps/mobile/eas.json` SHALL define exactly two build profiles, `preview` (internal distribution, Android APK) and `production`, and SHALL hold no `submit` section. Neither `eas.json` nor `apps/mobile/app.json` SHALL hold an Expo account (`owner`), an EAS project id (`extra.eas`) or a store credential.

#### Scenario: Two build profiles and no submit
- **WHEN** the release-config check reads `apps/mobile/eas.json`
- **THEN** its `build` keys are exactly `preview` and `production`, `build.preview.distribution` is `internal`, `build.preview.android.buildType` is `apk`, and the file has no `submit` key

#### Scenario: No account in the app config
- **WHEN** the release-config check reads `apps/mobile/app.json`
- **THEN** `expo.owner` and `expo.extra.eas` are absent

### Requirement: Mobile app icon from the brand tokens
The app icon SHALL be a 1024 × 1024 opaque PNG of the brand surface with the mark in on-brand, and the Android adaptive icon a 1024 × 1024 transparent PNG of the on-brand mark inside the safe zone over a `brand` background colour. Both SHALL be produced from the values in `packages/ui/src/tokens.css` by `apps/mobile/scripts/icons.mjs`, and the committed files SHALL equal its output.

#### Scenario: Committed icons match the generator
- **WHEN** the icons check renders the icon and the adaptive icon with the `--brand` and `--on-brand` values of `tokens.css`
- **THEN** the pixels of `apps/mobile/assets/icon.png` and `apps/mobile/assets/adaptive-icon.png` equal the rendered pixels, both are 1024 × 1024, the icon has no alpha channel and its corner pixel is the brand colour, and the centre pixel of each is the on-brand colour, opaque

#### Scenario: App config points at the icons
- **WHEN** the icons check reads `apps/mobile/app.json`
- **THEN** `expo.icon` is `./assets/icon.png`, `expo.android.adaptiveIcon.foregroundImage` is `./assets/adaptive-icon.png`, both files exist, and `expo.android.adaptiveIcon.backgroundColor` equals the `--brand` value of `tokens.css`

### Requirement: Mobile splash screen from the brand tokens
The app SHALL configure its native splash screen through the `expo-splash-screen` config plugin with the on-brand mark from `apps/mobile/assets/splash-icon.png` (1024 × 1024, transparent, produced and checked like the icons) centred on the `brand` background colour.

#### Scenario: Splash uses the brand surface and the mark
- **WHEN** the icons check reads the `expo-splash-screen` entry in `expo.plugins` of `apps/mobile/app.json`
- **THEN** its `image` is `./assets/splash-icon.png`, `backgroundColor` equals the `--brand` value of `tokens.css`, `imageWidth` is 200 and `resizeMode` is `contain`, and the pixels of `splash-icon.png` equal the generator's rendering

### Requirement: Mobile device run notes
`apps/mobile/README.md` SHALL tell a developer how to run the app on a phone with Expo Go against core on the computer's LAN address, how to make an EAS preview build, and how to regenerate the icons.

#### Scenario: Device notes name the commands
- **WHEN** the release-config check reads `apps/mobile/README.md`
- **THEN** it contains `npx expo start --port 5176`, `EXPO_PUBLIC_CORE_URL=http://<lan-ip>:8080`, `Expo Go`, `npx eas-cli build --profile preview` and `node scripts/icons.mjs`

### Requirement: Mobile order history
While a token is held, the Orders tab SHALL show the heading "Your orders" and the first page of `GET /orders` in core's order, one card per order: number (tabular), status `Badge`, placed time, item count ("1 item" or "N items", the sum of the quantities) and total in `₹`. The whole card SHALL be one link named "View order <number>" that opens `/orders/<id>`. When `total` is above the orders listed, the list SHALL end with "Showing your latest N orders.".

#### Scenario: History lists orders
- **WHEN** `GET /orders` answers `SS-DEMOAAAD` (`placed` today at 10:02 local time, quantities 3 and 1, total 103000) and then `SS-DEMOAAAC` (`cancelled`, one line of quantity 1, total 39900) with `total` 2, and the Orders tab is shown
- **THEN** two cards are listed in that order: the first is a link named "View order SS-DEMOAAAD" holding "Placed", "Today, 10:02 · 4 items" and "₹1,030", the second holds "Cancelled" and "1 item", and no "Showing your latest" text is shown; with `total` 30 the list ends with "Showing your latest 2 orders."

#### Scenario: Card opens the order
- **WHEN** the Orders tab lists `SS-DEMOAAAD` with id `00000000-0000-4000-8000-000000000703` and the customer presses "View order SS-DEMOAAAD"
- **THEN** the path is `/orders/00000000-0000-4000-8000-000000000703` and the level-1 heading is "Order SS-DEMOAAAD"

### Requirement: Mobile order placed time
The history card's placed time SHALL read "Today, HH:MM" on the device's current day, "D Mon, HH:MM" on another day of the current year and "D Mon YYYY, HH:MM" in another year, in the device's local time on a 24-hour clock.

#### Scenario: Placed time wording
- **WHEN** the placed time is asked, with the device clock at 16 October 2026 15:00 local, for 16 October 2026 10:02, 12 October 2026 19:40 and 4 October 2025 21:05 local
- **THEN** it is "Today, 10:02", "12 Oct, 19:40" and "4 Oct 2025, 21:05"

### Requirement: Mobile order history signed out
With no token held, the Orders tab SHALL show "Sign in to see your orders" and a "Sign in" button that opens `/sign-in?returnTo=%2Forders`, and send no request; it SHALL not redirect, so Back from sign-in does not loop.

#### Scenario: Signed-out Orders tab
- **WHEN** the Orders tab is shown with no token
- **THEN** "Sign in to see your orders" and a "Sign in" button are shown and no request is sent to core

#### Scenario: Sign in from the Orders tab
- **WHEN** the Orders tab is shown with no token and the customer presses "Sign in"
- **THEN** the path is `/sign-in` with `returnTo` `/orders`

### Requirement: Mobile order history states
The Orders tab SHALL show, while the list loads, a skeleton named "Loading"; when the customer has no orders, the empty state "No orders yet" with "Your past and current orders show up here." and a "Start shopping" button that opens Home; and when the read fails with nothing held, the `ErrorBanner` with "Try again", which reads the list again.

#### Scenario: Orders loading
- **WHEN** the Orders tab is shown with a token and `GET /orders` has not answered
- **THEN** an element named "Loading" is shown

#### Scenario: No orders yet
- **WHEN** `GET /orders` answers no orders with `total` 0
- **THEN** "No orders yet", "Your past and current orders show up here." and a "Start shopping" button are shown

#### Scenario: Start shopping opens Home
- **WHEN** the empty state is shown and the customer presses "Start shopping"
- **THEN** the path is `/`

#### Scenario: Orders fail to load
- **WHEN** core cannot be reached and no list is held; then core answers one order and "Try again" is pressed
- **THEN** an alert "You're offline" with a "Try again" button is shown; then the order's card is shown

### Requirement: Mobile order history read again on return
The Orders tab SHALL read `GET /orders` again each time it is shown again after the first time, keeping the list on screen while it reads; a read that fails SHALL keep the list it holds, with no alert.

#### Scenario: Statuses current on return
- **WHEN** the Orders tab shows `SS-DEMOAAAD` as "Placed", the customer opens the Home tab, core now answers it `packing`, and the customer opens the Orders tab again
- **THEN** its card shows "Packing" and core received two `GET /orders`

#### Scenario: Failed read on return keeps the list
- **WHEN** the Orders tab shows `SS-DEMOAAAD`, the customer opens the Home tab, core can no longer be reached, and the customer opens the Orders tab again
- **THEN** the card "View order SS-DEMOAAAD" is still shown and no alert is shown

### Requirement: Mobile order tracking screen
While a token is held, `/orders/<id>` SHALL show the order `GET /orders/{id}` answers, in this order: a brand header with "Back", the level-1 heading "Order <number>" (tabular), the headline and the status message; the "Order status" timeline; the rider card; the products card; the address card; "Cancel order"; and a "Need help?" button that opens `/account`. The document title SHALL be "Order <number> · ShopperStop".

#### Scenario: Need help opens the account
- **WHEN** a held order is shown and the customer presses "Need help?"
- **THEN** the path is `/account`

### Requirement: Mobile order products and address
The products card SHALL be headed "<N> products · Cash on delivery" (N the lines, "1 product" for one), with a row "<quantity> × <name>" and the line total per line, "Delivery fee" with the fee or "Free", and "Pay on delivery" with the total while the order is under way, "Total" otherwise. The address card SHALL be headed "Delivering to <label>" while under way, "Address: <label>" otherwise, over `line1`, `line2` when present and `pincode` joined by ", ".

#### Scenario: Tracking shows the order
- **WHEN** order `SS-DEMOAAAD` is `placed`, holds 2 of "Toned milk" at 2900 and 1 of "Whole wheat bread" at 5000, subtotal 10800, fee 2500, total 13300, to "Home", "12 80 Feet Rd", "Koramangala", `560034`, and `/orders/<its id>` is shown
- **THEN** the level-1 heading is "Order SS-DEMOAAAD", "2 products · Cash on delivery", "2 × Toned milk" with ₹58, "1 × Whole wheat bread" with ₹50, "Delivery fee" with ₹25, "Pay on delivery" with ₹133, "Delivering to Home" and "12 80 Feet Rd, Koramangala, 560034" are shown, and a "Need help?" button is shown

#### Scenario: Finished order labels
- **WHEN** the order is `delivered` with fee 0, total 9500 and one line of quantity 1
- **THEN** "1 product · Cash on delivery", "Delivery fee" with "Free", "Total" with ₹95 and "Address: Home" are shown, and neither "Pay on delivery" nor "Delivering to" is shown

### Requirement: Mobile order tracking states
A 404 SHALL show the level-1 heading "Order not found" and a "Your orders" button that opens `/orders`. While nothing is held the heading SHALL be "Your order", over a skeleton named "Loading" while the read runs or, when it failed, the `ErrorBanner` with "Try again" and the line "Your order is safe. We just couldn't load its latest status.".

#### Scenario: Unknown order
- **WHEN** core answers `GET /orders/{id}` with 404
- **THEN** the level-1 heading is "Order not found" and a "Your orders" button is shown

#### Scenario: Your orders from an unknown order
- **WHEN** "Order not found" is shown and the customer presses "Your orders"
- **THEN** the path is `/orders`

#### Scenario: Tracking loading
- **WHEN** `/orders/<id>` is shown with a token and `GET /orders/{id}` has not answered
- **THEN** the level-1 heading is "Your order" and an element named "Loading" is shown

#### Scenario: Tracking fails with nothing held
- **WHEN** core answers `GET /orders/{id}` with 500 `internal` and nothing is held
- **THEN** the level-1 heading is "Your order", an alert "Something went wrong on our side" with "Try again" is shown, and "Your order is safe. We just couldn't load its latest status." is shown

### Requirement: Mobile order tracking requires sign-in
With no token held, `/orders/<id>` SHALL replace itself with `/sign-in?returnTo=` and its own path, encoded, so the customer comes back to the order after signing in.

#### Scenario: Signed-out tracking redirect
- **WHEN** the app opens `/orders/00000000-0000-4000-8000-000000000703` with no token
- **THEN** the path is `/sign-in` with `returnTo` `/orders/00000000-0000-4000-8000-000000000703`

### Requirement: Mobile order status names
The app SHALL name an order's status in badges "Placed", "Accepted", "Packing", "Ready", "Out for delivery", "Delivered" or "Cancelled", with the `Badge` variant `accent` for the first five, `success` for delivered and `neutral` for cancelled (PLAN.md D28).

#### Scenario: Status names and badges
- **WHEN** the name and badge variant are asked for each of core's seven statuses
- **THEN** they are "Placed", "Accepted", "Packing", "Ready" and "Out for delivery" with `accent`, "Delivered" with `success` and "Cancelled" with `neutral`

### Requirement: Mobile order status message
The tracking header SHALL show the status in one element with the role `status` and a polite live region, which stays in place when the status changes: "Order placed. Waiting for the store to accept it.", "The store accepted your order.", "Your order is being packed.", "Your order is packed and ready to leave the store.", "Your order is out for delivery.", "Your order was delivered." or "This order was cancelled.", the last followed by " Reason: <cancelReason>" when there is one.

#### Scenario: Status change announced in place
- **WHEN** the tracking screen shows a `placed` order and the next read answers it `accepted`
- **THEN** the element with the role `status` that read "Order placed. Waiting for the store to accept it." is the same element and reads "The store accepted your order."

#### Scenario: Cancelled order shows the reason
- **WHEN** the order is `cancelled` with `cancelReason` "Ordered by mistake"; and separately `cancelled` with none
- **THEN** the status reads "This order was cancelled. Reason: Ordered by mistake" the first time and "This order was cancelled." the second

### Requirement: Mobile order headline
The tracking header SHALL show a headline, outside the status element so a minute changing is not announced: while the order is under way, "Arriving in N min", N the whole minutes, rounded up, from now to `placedAt` plus the order's own `promisedMinutes`, kept current as time passes; once that moment has passed, "Running late"; "Delivered" once `delivered`; "Cancelled" once `cancelled`.

#### Scenario: Headline wording
- **WHEN** the headline is asked for an order under way placed 3 minutes ago, 9 minutes 30 seconds ago, 10 minutes ago and 3 hours ago with `promisedMinutes` 10, and for a `delivered` and a `cancelled` order
- **THEN** it is "Arriving in 7 min", "Arriving in 1 min", "Running late", "Running late", "Delivered" and "Cancelled"

#### Scenario: Headline kept current
- **WHEN** the headline shows "Arriving in 7 min" for a `placed` order with `promisedMinutes` 10 and 60 seconds pass with no new read
- **THEN** it shows "Arriving in 6 min"

### Requirement: Mobile order timeline
The tracking screen SHALL show a card "Order status" with the order's steps. For an order not cancelled the steps SHALL be "Order placed", "Accepted by store", "Packing your order", "Ready for pickup", "Out for delivery" and "Delivered", for `placed` to `delivered`. A reached step SHALL show its latest event's time as HH:MM, local 24-hour; the current step SHALL be bold, earlier steps done, later steps muted without a time; a delivered order's steps are all done.

#### Scenario: Timeline of a packing order
- **WHEN** a `packing` order's events are `placed` at 10:02, `accepted` at 10:03 and `packing` at 10:04 local time
- **THEN** the six step names are shown in order, "10:02", "10:03" and "10:04" are shown under the first three, no time is shown under the other three, and "Packing your order" is set in bold

### Requirement: Mobile cancelled order timeline
For a cancelled order the "Order status" steps SHALL be its events oldest first, each under its step name or "Cancelled", each with its time.

#### Scenario: Timeline of a cancelled order
- **WHEN** a `cancelled` order's events are `placed` at 10:02 and `cancelled` at 10:05 local time
- **THEN** the steps are "Order placed" with "10:02" and "Cancelled" with "10:05", and "Accepted by store" is not shown

### Requirement: Mobile timeline names the rider
Under a step made by a rider (`actorType` `rider`) with an `actorName`, the timeline SHALL show "Picked up by <actorName>" for `out_for_delivery` and "Delivered by <actorName>" for `delivered`, and no actor line under any other step.

#### Scenario: Rider steps name the rider
- **WHEN** a `delivered` order's events are placed by the customer, accepted, packing and ready by staff, then `out_for_delivery` and `delivered` by the rider "Asha"
- **THEN** "Picked up by Asha" and "Delivered by Asha" are shown, and no other step shows "by"

### Requirement: Mobile order tracking poll
While the order held is not `delivered` or `cancelled`, the tracking screen SHALL read `GET /orders/{id}` again every 10 seconds and SHALL stop once it is `delivered` or `cancelled`, or is unknown. A repeat that fails SHALL leave the screen as it is, with no alert, and the repeats SHALL go on.

#### Scenario: Poll interval follows the status
- **WHEN** the tracking read's repeat interval is asked for an order in each status, for an unknown order and for no answer yet
- **THEN** it is 10 seconds for `placed`, `accepted`, `packing`, `ready` and `out_for_delivery`, and none for `delivered`, `cancelled`, the unknown order and no answer

#### Scenario: Failed poll keeps the order
- **WHEN** a `placed` order is shown and the read it repeats fails because core cannot be reached
- **THEN** the level-1 heading "Order SS-DEMOAAAD" and the status message are still shown and no alert is shown

### Requirement: Mobile order cancel
The tracking screen SHALL show "Cancel order" only while the order is `placed` or `accepted`. It SHALL open a dialog "Cancel this order?" that says the order has not been packed and nothing has been charged, offers an optional reason of four choices (none chosen at first; pressing the chosen one clears it), and holds "Keep order" first, then "Cancel order". "Keep order" SHALL close the dialog and send nothing.

#### Scenario: Cancel offered while placed or accepted
- **WHEN** the tracking screen shows a `placed` order, an `accepted` order and a `packing` order
- **THEN** a "Cancel order" button is shown for the first two and not for the third

#### Scenario: Cancel dialog contents
- **WHEN** "Cancel order" is pressed on the `placed` order `SS-DEMOAAAD`
- **THEN** a dialog "Cancel this order?" shows "Order SS-DEMOAAAD hasn't been packed yet, so you can still cancel it. Nothing has been charged.", "Reason (optional)" with "Ordered by mistake", "Want to change items", "Delivery is taking too long" and "Other", none of them selected, and its buttons are "Keep order" and then "Cancel order"

#### Scenario: Keep order
- **WHEN** the dialog is open and "Keep order" is pressed
- **THEN** the dialog is closed and no `POST /orders/{id}/cancel` was sent

### Requirement: Mobile order cancel sent
Confirming SHALL send `POST /orders/{id}/cancel` with `{"reason": "<choice>"}`, or `{}` when none is chosen, once while it is pending, close the dialog and show the answered order. A refusal SHALL keep the dialog open with an alert: on 409, "This order can no longer be cancelled.", with the order read again; otherwise "Could not cancel the order. Try again.".

#### Scenario: Order cancelled with a reason
- **WHEN** "Cancel order" is pressed on a `placed` order, "Ordered by mistake" is chosen, "Cancel order" is pressed in the dialog, and core answers the order `cancelled` with `cancelReason` "Ordered by mistake"
- **THEN** the dialog "Cancel this order?" opened with "Keep order" as its first button, core received the body `{"reason":"Ordered by mistake"}`, and afterwards the dialog is closed, the status reads "This order was cancelled. Reason: Ordered by mistake" and no "Cancel order" button is shown

#### Scenario: Order cancelled without a reason
- **WHEN** "Ordered by mistake" is chosen and pressed again, then "Cancel order" is pressed in the dialog
- **THEN** core received the body `{}`

#### Scenario: Cancel refused
- **WHEN** confirming answers 409 `conflict`; and separately core cannot be reached
- **THEN** the dialog stays open with an alert "This order can no longer be cancelled." the first time, after which core received another `GET /orders/{id}`, and "Could not cancel the order. Try again." the second

### Requirement: Mobile order rider card
While the order is `out_for_delivery` or `delivered` and a rider name is known (`Order.riderName`, else the rider read's `riderName`), the tracking screen SHALL show a card headed "Your rider" with the name and the order's status `Badge`. When the rider read carries a `location`, the card SHALL also show "Last seen <relative time>" and an "Open in Maps" button that opens `https://www.google.com/maps?q=<lat>,<lng>` through the device.

#### Scenario: Rider on the way with a position
- **WHEN** the order is `out_for_delivery` with `riderName` "Asha", the rider read answers `assigned` with location 12.9352, 77.6245 recorded 3 minutes ago, and "Open in Maps" is pressed
- **THEN** "Your rider", "Asha", the badge "Out for delivery" and "Last seen 3 minutes ago" are shown, the rider read carried the customer's bearer, and the device was asked to open `https://www.google.com/maps?q=12.9352,77.6245`

#### Scenario: Rider without a position
- **WHEN** the order is `out_for_delivery` with `riderName` "Asha" and the rider read answers `assigned` with no location
- **THEN** "Your rider" and "Asha" are shown and neither "Last seen" nor "Open in Maps"

#### Scenario: No rider card before a rider
- **WHEN** the order is `ready`; and separately `out_for_delivery` with no `riderName` and the rider read answering 404
- **THEN** no "Your rider" card is shown either time, and for the `ready` order no request to `/api/rider/` was sent

#### Scenario: Delivered order names the rider from the rider read
- **WHEN** the order is `delivered` with no `riderName` and the rider read answers "Arjun Rao" `delivered` with no location
- **THEN** "Your rider", "Arjun Rao" and the badge "Delivered" are shown, and no "Open in Maps"

### Requirement: Mobile rider last seen
"Last seen" SHALL count whole minutes, rounded down, from the location's `recordedAt` to now: "just now" under one minute (or when `recordedAt` is ahead of the device clock), "1 minute ago", "N minutes ago" under an hour, then "1 hour ago" or "N hours ago" in whole hours.

#### Scenario: Last seen wording
- **WHEN** the wording is asked for a position recorded 30 seconds, 1 minute, 59 minutes, 60 minutes and 150 minutes before now, and 2 minutes after now
- **THEN** it is "Last seen just now", "Last seen 1 minute ago", "Last seen 59 minutes ago", "Last seen 1 hour ago", "Last seen 2 hours ago" and "Last seen just now"

### Requirement: Mobile order rider read
The app SHALL read `GET /api/rider/v1/orders/{orderId}/delivery` from `EXPO_PUBLIC_RIDER_URL` (default `http://localhost:8081`) with the customer's token and the same failed-answer handling as core reads, only while the order is `out_for_delivery` or `delivered`: every 10 seconds on `out_for_delivery`, once on `delivered`. A 404 SHALL mean no rider; a failed read SHALL show no alert and keep what is shown.

#### Scenario: Default rider URL
- **WHEN** the rider client is built with `EXPO_PUBLIC_RIDER_URL` unset
- **THEN** its base URL is `http://localhost:8081/api/rider/v1`

#### Scenario: Rider read follows the status
- **WHEN** the rider read's options are asked for an order in each of the seven statuses
- **THEN** the read is enabled only for `out_for_delivery` (repeating every 10 seconds) and `delivered` (not repeating)

#### Scenario: Failed rider read keeps the card
- **WHEN** the rider card shows "Asha" with "Last seen 3 minutes ago" and the next rider read fails because the rider service cannot be reached
- **THEN** the card still shows "Asha" and "Last seen 3 minutes ago", and no alert is shown

### Requirement: Mobile tab bar landmark
The bottom tab bar SHALL sit inside a navigation landmark named "Main", so every tab label is inside a landmark on the web export (axe `region`) and screen readers can jump to it.

#### Scenario: Tab bar in a navigation landmark
- **WHEN** the app shows a tab screen
- **THEN** the element holding the "Home", "Categories" and "Orders" tabs has the role `navigation` and the name "Main"

### Requirement: Mobile orders end-to-end suite
The mobile Playwright suite SHALL drive the order screens on the web export at 390×844 against core with the demo seed, creating any order it changes through core's HTTP API as a customer registered for the run, and SHALL run axe on every screen it visits, the cancel dialog open included, with no violation allowed.

#### Scenario: History and a delivered order against core
- **WHEN** the demo customer is signed in, opens the Orders tab, then presses "View order SS-DEMOAAAB"
- **THEN** three cards are listed, `SS-DEMOAAAD` with "Placed", `SS-DEMOAAAC` with "Cancelled" and `SS-DEMOAAAB` with "Delivered"; the tracking screen's heading is "Order SS-DEMOAAAB" with the headline "Delivered", the status "Your order was delivered.", six timeline steps, "Your rider" with "Arjun Rao" and no "Open in Maps"; and axe reports no violations on both screens

#### Scenario: Tracking follows the order against core
- **WHEN** a customer registered for the run has a `placed` order made through core's API open on its tracking screen, and store staff move it through core's API step by step to `delivered`
- **THEN** the headline first reads "Arriving in N min", and without a reload the status comes to read "Your order was delivered." within 15 seconds of the last move, the headline reads "Delivered", and axe reports no violations

#### Scenario: Cancel against core
- **WHEN** a customer registered for the run opens their `placed` order from the Orders tab, presses "Cancel order", chooses "Ordered by mistake" and confirms
- **THEN** the status reads "This order was cancelled. Reason: Ordered by mistake", core's `GET /orders/{id}` answers `cancelled` with that reason, no "Cancel order" button is shown, and axe reports no violations with the dialog open and after it closes
