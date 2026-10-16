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
The app SHALL open on a tab layout with the tabs Home, Categories and Orders in that order, each a Lucide icon over its label, the current tab in `accent`. Home SHALL show a `brand` header holding a level-1 heading that starts with "ShopperStop" and an icon button "Account" that opens `/account`. What each tab shows below its header is set by the requirement for that screen.

#### Scenario: Home in the tabs
- **WHEN** the app renders `/` with `560034` stored and resolving to an open store with `promisedMinutes` 10
- **THEN** the tabs Home, Categories and Orders are shown in that order with Home selected, the level-1 heading "ShopperStop in 10 minutes" is shown, and an "Account" button is shown

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
- **THEN** axe reports no violations with the field error showing, and the browser ends on `/` with a level-1 heading starting "ShopperStop"

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

### Requirement: Mobile pincode choice
The app SHALL keep the chosen pincode in memory and in the device's async storage under `shopperstop:pincode` (the browser's `localStorage`, same key, on the web export), SHALL read it once when the app loads, and SHALL ignore a stored value that is not six digits with a first digit from 1 to 9. Until the read finishes the pincode SHALL count as not yet known, and a pincode chosen meanwhile SHALL win over the value read. When storage fails, the pincode SHALL still be held in memory.

#### Scenario: Pincode persisted
- **WHEN** the pincode store is given `560034`
- **THEN** async storage holds `shopperstop:pincode` = `560034` and the store holds `560034`

#### Scenario: Pincode restored on load
- **WHEN** async storage holds `shopperstop:pincode` = `560038` before the pincode store first reads it, and in a second load holds `abc`
- **THEN** the first store holds `560038` once read, and the second holds no pincode once read

#### Scenario: Chosen pincode wins over a late read
- **WHEN** async storage holds `560038`, the pincode store is given `560034` before its first read finishes
- **THEN** the store holds `560034` after the read finishes

#### Scenario: Blocked storage tolerated
- **WHEN** every async storage call rejects and the pincode store is given `560034`
- **THEN** nothing throws and the store holds `560034`

### Requirement: Mobile pincode sheet
The app SHALL offer one sheet "Where should we deliver?" with a "Pincode" field (digits only, at most six) prefilled with the stored pincode and a "Continue" button disabled until it holds a valid pincode; six digits that are not one SHALL show "That is not a valid pincode.". "Continue" SHALL resolve the pincode, then store it and close the sheet, unless the store change confirm applies. The sheet SHALL open on Home once no pincode is known to be stored, and when a pincode control is chosen.

#### Scenario: First visit opens the pincode sheet
- **WHEN** the app renders `/` with no pincode stored
- **THEN** the dialog "Where should we deliver?" is open with an empty "Pincode" field and a disabled "Continue" button

#### Scenario: Only digits, six at most
- **WHEN** `56a00349` is typed into the Pincode field
- **THEN** the field holds `560034` and "Continue" is enabled

#### Scenario: Invalid pincode refused
- **WHEN** `012345` is typed into the Pincode field
- **THEN** "That is not a valid pincode." shows under the field, "Continue" is disabled and nothing is stored

#### Scenario: Pincode saved from the sheet
- **WHEN** `560034` is typed in the sheet opened on first visit and "Continue" is chosen while core resolves it to an open store
- **THEN** the dialog closes and async storage `shopperstop:pincode` is `560034`

#### Scenario: Header control opens the sheet
- **WHEN** `560034` is stored and resolves to an open store, the app renders `/`, and "Delivering to 560034" is chosen
- **THEN** the dialog "Where should we deliver?" opens with `560034` in the "Pincode" field

### Requirement: Mobile pincode sheet saved addresses
Signed in, the pincode sheet SHALL show one choice per saved address, named "<label> · <pincode>", that puts that pincode in the field. Signed out, it SHALL show instead a link "Have an account? Sign in to use a saved address" to `/sign-in?returnTo=%2F`.

#### Scenario: Saved address fills the pincode
- **WHEN** a signed-in customer with the saved address "Work" at `560038` opens the sheet and chooses "Work · 560038"
- **THEN** the Pincode field holds `560038`, and no "Have an account?" link is shown

#### Scenario: Sign-in link when signed out
- **WHEN** a signed-out customer's sheet is open and "Have an account? Sign in to use a saved address" is chosen
- **THEN** the sign-in screen is shown with `returnTo` `/`

### Requirement: Mobile store resolution
While a pincode is stored the app SHALL resolve it with `GET /serviceability?pincode=<pincode>` when it is first known and when it changes. While an open store is resolved Home's header SHALL show the level-1 heading "ShopperStop in <N> minutes" (N its `promisedMinutes`) and a search field; otherwise the heading SHALL read "ShopperStop". The header SHALL hold a button "Delivering to <pincode>", or "Choose pincode" with no pincode stored, that opens the pincode sheet.

#### Scenario: Header shows the delivery promise
- **WHEN** `560034` is stored and resolves to an open store with `promisedMinutes` 10
- **THEN** Home's level-1 heading is "ShopperStop in 10 minutes", a "Delivering to 560034" button is shown, and a "Search products" button is shown

#### Scenario: Pincode resolves against core
- **WHEN** a browser on `/` continues with `560034` in the pincode sheet against core with the demo seed, then reloads
- **THEN** the heading "ShopperStop in 10 minutes" and the button "Delivering to 560034, Bengaluru" are shown before and after the reload, the sheet is not open after the reload, and axe reports no violations on `/` with the sheet open and with it closed

### Requirement: Mobile header names the city
When the resolved store has a `city`, Home's pincode button SHALL read "Delivering to <pincode>, <city>".

#### Scenario: Header names the city
- **WHEN** `560034` is stored and resolves to an open store with `city` "Bengaluru"
- **THEN** the header's pincode button is named "Delivering to 560034, Bengaluru"

### Requirement: Mobile store notices
Home, Categories, Category, Product and Search SHALL show, instead of their content, while no open store is resolved: with no pincode, "Set your pincode" and a "Choose pincode" button; until the lookup answers, a skeleton labelled "Loading"; on 404 `not_serviceable`, "We don't deliver here yet" and a "Change pincode" button; on any other failure, the error state with "Try again". Notice titles SHALL be level-2 headings and the pincode buttons SHALL open the pincode sheet.

#### Scenario: Not serviceable notice
- **WHEN** `110001` is stored, core answers 404 `not_serviceable` for it, and the app renders `/`
- **THEN** the heading "We don't deliver here yet" is shown and choosing "Change pincode" opens the pincode sheet

#### Scenario: Store lookup fails
- **WHEN** `560034` is stored, core cannot be reached, and the app renders `/`
- **THEN** the alert "You're offline" with a "Try again" button is shown, and choosing it after core answers an open store shows "Picked for you"

#### Scenario: No pincode notice
- **WHEN** no pincode is stored, the customer closes the first-visit sheet, and then chooses "Choose pincode"
- **THEN** the heading "Set your pincode" is shown, and the dialog "Where should we deliver?" opens again

#### Scenario: Notices against core
- **WHEN** a browser continues with `110001` in the pincode sheet, and then with a pincode served only by a closed store
- **THEN** the not-serviceable notice and then the closed notice are shown, and axe reports no violations on either

### Requirement: Mobile closed store notice
For a store with `isOpen` false the same screens SHALL show instead of their content the level-2 heading "<store name> store is closed", a "Change pincode" button opening the pincode sheet and a "See your orders" link to `/orders`.

#### Scenario: Closed store notice
- **WHEN** `560034` is stored and resolves to a store named "Koramangala" with `isOpen` false, and the app renders `/`
- **THEN** the heading "Koramangala store is closed", a "Change pincode" button and a "See your orders" link are shown, and no "Picked for you" section

### Requirement: Mobile product card
Every listed product SHALL be a card with one link to `/product/<slug>` named "<name> <unit>" holding a square image tile (its `imageUrl` on core's origin, else a placeholder icon), the stock badge, its name and its unit; below the link its `Price` with the MRP struck through when higher, and a `Stepper` labelled with its name whose maximum is its `quantity` (0 when out of stock). Choosing "ADD" SHALL set its count to 1.

#### Scenario: Card links and prices
- **WHEN** a card renders a product "Amul Taaza" with slug `amul-taaza`, unit `500 ml`, `priceCents` 2700, `mrpCents` 2900, `quantity` 3 and no `imageUrl`
- **THEN** a link named "Amul Taaza 500 ml" opens `/product/amul-taaza`, "Only 3 left", "₹27" and the struck-through "₹29" are shown, the image tile shows the placeholder, and an "Add Amul Taaza" button is shown

#### Scenario: Add shows the count
- **WHEN** "Add Amul Taaza" is chosen on an in-stock card
- **THEN** the group "Quantity of Amul Taaza" shows 1

#### Scenario: Out-of-stock card
- **WHEN** a card renders a product with `inStock` false and `quantity` 0
- **THEN** a disabled "Out of stock" button is shown, with no "Add" button and no stock badge

### Requirement: Mobile stock badge
Product cards and the product screen SHALL show, while the product is in stock, a stock badge reading "10+ left" when `quantity` is 10 (core's display cap) and "Only N left" below 10, and no badge when it is out of stock.

#### Scenario: Plenty in stock
- **WHEN** the product screen shows a product with `quantity` 10 and `inStock` true
- **THEN** "10+ left" is shown

### Requirement: Mobile Stepper
A `Stepper` with a count of 0 SHALL be an outlined "ADD" button named "Add <name>" ("Add to cart" with the same name in its large size); above 0 it SHALL be a group "Quantity of <name>" holding "Remove one <name>", the count in tabular numbers, and "Add one <name>", which SHALL be disabled at the maximum. A maximum of 0 SHALL show a disabled "Out of stock" button instead. Every control SHALL offer at least a 44 by 44 point touch area.

#### Scenario: Stepper counts within the maximum
- **WHEN** a Stepper for "Toned milk" with maximum 2 is at 0, and "Add Toned milk", then "Add one Toned milk" are chosen
- **THEN** the group "Quantity of Toned milk" shows 2 and "Add one Toned milk" is disabled; choosing "Remove one Toned milk" twice shows "Add Toned milk" again

### Requirement: Mobile home
For an open store Home SHALL show, below its header, a "Shop by category" section of parent tiles from `GET /stores/{id}/categories` (square image and name, four to a row) each opening `/category/<slug>`, and a "Picked for you" row of product cards: in core's order, the first 12 in-stock products of page one of `GET /stores/{id}/products`. Each section SHALL follow the loading and error pattern on its own. The header's search field SHALL be a button "Search products" that opens `/search`.

#### Scenario: Home lists categories and picks
- **WHEN** an open store is resolved whose categories are three parents and whose first product page holds 14 products, the 2nd and 5th out of stock
- **THEN** "Shop by category" holds three tiles linking to `/category/<slug>`, and "Picked for you" lists 12 products, none out of stock, in the order core answered them

#### Scenario: Home sections fail apart
- **WHEN** an open store is resolved, its categories answer 500 and its products answer normally
- **THEN** "Shop by category" shows the alert "Something went wrong on our side" with "Try again", and "Picked for you" lists the products

#### Scenario: Search field opens search
- **WHEN** "Search products" is chosen on Home
- **THEN** the location is `/search` and the "Search products" box is shown

#### Scenario: Home against core
- **WHEN** a browser with `560034` chosen opens `/` against core with the demo seed
- **THEN** "Picked for you" lists 12 products, "Shop by category" holds a "Fruits & Vegetables" tile, and axe reports no violations

### Requirement: Mobile categories tab
The Categories tab SHALL show a white header with the level-1 heading "Categories" and, for an open store, every parent category as a tile opening `/category/<slug>`.

#### Scenario: Categories tab lists parents
- **WHEN** an open store's categories are the parents "Fruits & Vegetables" and "Dairy, Bread & Eggs" and the Categories tab is chosen
- **THEN** the heading "Categories" and a link for each parent are shown, and choosing "Dairy, Bread & Eggs" shows the location `/category/dairy-bread-eggs`

### Requirement: Mobile category screen
`/category/<slug>` SHALL find the slug among the store's categories (a parent selects itself, a child selects itself under its parent) and show a header with "Back", the parent's name as the level-1 heading and a "Search" button opening `/search`, then the paged products of the selected category from `GET /stores/{id}/products?categoryId=`. An unknown slug SHALL show "Category not found" with a "Go to Home" link.

#### Scenario: Unknown category
- **WHEN** the app renders `/category/nope` with an open store whose categories hold no `nope`
- **THEN** "Category not found" is shown with a "Go to Home" link

### Requirement: Mobile category tabs
The category screen SHALL show down its left a tab list "Subcategories" with "All" (the parent) and one tab per child, the selected one marked selected. Choosing a tab SHALL change the location to `/category/<its slug>` and keep the heading.

#### Scenario: Category tabs
- **WHEN** an open store's categories hold the parent "Dairy, Bread & Eggs" (`dairy-bread-eggs`) with children "Milk" (`milk`) and "Eggs" (`eggs`), the app renders `/category/dairy-bread-eggs`, and the "Milk" tab is chosen
- **THEN** the level-1 heading is "Dairy, Bread & Eggs" with the "All" tab selected first, and after the choice the location is `/category/milk`, the "Milk" tab is selected, the heading is unchanged and the products are read with Milk's `categoryId`

#### Scenario: Browse a category against core
- **WHEN** a browser with `560034` chosen opens the "Dairy, Bread & Eggs" tile on Home and then a child tab
- **THEN** the location is `/category/<the child's slug>`, products are listed, and axe reports no violations on both

### Requirement: Mobile category filters
The category screen SHALL show above its products the chips "In stock" and "Price: low to high", each marked selected while on and toggled by a press. While "In stock" is on the products SHALL be read with `inStock=true`, and while "Price: low to high" is on with `sort=price_asc`, from page one; the filters SHALL stay while the customer changes tabs on the same screen.

#### Scenario: Filters sent to core
- **WHEN** the category screen shows "Dairy, Bread & Eggs", "In stock" is chosen, then "Price: low to high", then "In stock" again
- **THEN** the products are read with `inStock=true`, then with `inStock=true&sort=price_asc`, then with `sort=price_asc` and no `inStock`, each from `page=1`, and only "Price: low to high" is selected at the end

#### Scenario: Category filters against core
- **WHEN** a browser with `560034` chosen opens a category and chooses "In stock" and "Price: low to high"
- **THEN** no "Out of stock" button is listed, the first two prices are in ascending order, and axe reports no violations

### Requirement: Mobile paged product lists
The category and search screens SHALL load products in pages of 24; while `page × pageSize` is below `total` a "Load more" button SHALL end the list and load the next page, and reaching the end of the list SHALL also load it.

#### Scenario: Load more while pages remain
- **WHEN** the first page of the selected category's products answers `total` 30 with 24 items
- **THEN** 24 products and a "Load more" button are shown, and choosing it requests `page=2` and shows 30 products without the button; with `total` 24 no "Load more" button is shown

#### Scenario: End of the list loads the next page
- **WHEN** the first page answers `total` 30 with 24 items and the list reports that its end was reached
- **THEN** `page=2` is requested once

### Requirement: Mobile search
`/search` SHALL show a header with "Back" and a search box "Search products" that has focus when the screen opens and a "Clear search" button while it holds text. Submitting the box SHALL set the location to `/search?q=<trimmed text>`. For a `q`, the screen SHALL show the level-1 heading "<total> products for “<q>”" ("1 product" for one) and the paged products of `GET /stores/{id}/products?q=`.

#### Scenario: Search submits
- **WHEN** " milk " is typed into "Search products" and submitted
- **THEN** the location is `/search?q=milk` and the heading "2 products for “milk”" is shown when core answers `total` 2

### Requirement: Mobile search empty states
Without `q` the search screen SHALL show the level-1 heading "Search for products"; when the search answers no products, "No results for “<q>”" with "Check the spelling, or browse a category instead."; both SHALL offer a link to `/category/<slug>` for each parent category.

#### Scenario: No results suggests categories
- **WHEN** an open store's search for `zzz` answers no products and its categories hold two parents
- **THEN** "No results for “zzz”" is shown with a link to `/category/<slug>` for each of the two parents

#### Scenario: Clear search
- **WHEN** the box holds "milk" and "Clear search" is chosen
- **THEN** the box is empty and has focus

#### Scenario: Search and load more against core
- **WHEN** a browser with `560034` chosen searches "banana", then searches "a" and loads more
- **THEN** "Banana Robusta" is listed for "banana", more than 24 products are listed for "a" after loading more, and axe reports no violations on `/search`

### Requirement: Mobile product screen
`/product/<slug>` SHALL show the product from `GET /stores/{id}/products/{slug}`: the square image tile with a "Back" button over it, the name as the level-1 heading, the unit, the stock badge, and "<N>% off" when the MRP is higher (N rounded down). A bar fixed to the bottom SHALL hold the large `Price` with the MRP struck through, "Inclusive of all taxes", and the large `Stepper`. A 404 SHALL show "Product not found" with a "Go to Home" link.

#### Scenario: Product with a discount
- **WHEN** the product `amul-curd` named "Amul Curd" has `priceCents` 4800, `mrpCents` 6000, `quantity` 3 and `inStock` true
- **THEN** the level-1 heading is "Amul Curd", "₹48", the struck-through "₹60", "20% off" and "Only 3 left" are shown, and an enabled "Add Amul Curd" button reading "Add to cart" is shown

#### Scenario: Out of stock product
- **WHEN** the product has `inStock` false and `quantity` 0
- **THEN** a disabled "Out of stock" button is shown, with no "Add" button and no stock badge

#### Scenario: Unknown product
- **WHEN** core answers 404 for the slug
- **THEN** "Product not found" is shown with a "Go to Home" link

### Requirement: Mobile product details
The product screen SHALL show the breadcrumb "Home / <parent> / <child>" with the names it finds among the store's categories, "Product details" with the unit, the category, and the brand and description when present, and "More in <category>": up to 10 other products of its category, each opening its own screen.

#### Scenario: More in the category
- **WHEN** the product's category "Milk" holds three other products
- **THEN** "More in Milk" lists those three and not the product itself, and the breadcrumb reads "Home / Dairy, Bread & Eggs / Milk"

#### Scenario: Product pages against core
- **WHEN** a browser with `560034` chosen opens Banana Robusta from a search and then the screen of a product the demo store holds none of
- **THEN** the first shows "Banana Robusta" with an enabled "Add Banana Robusta" button, the second a disabled "Out of stock" button, and axe reports no violations on either

### Requirement: Mobile store change confirm
When "Continue" in the pincode sheet resolves to a store other than the one the cart counts belong to and the cart counts at least one product, the sheet SHALL close and a dialog "Switch to the <new store> store?" SHALL open, saying "Your cart has <N> item(s) from <old store>; switching will empty it.", with "Keep cart" first and "Switch store". Any other "Continue" SHALL store the pincode without asking.

#### Scenario: Same store or empty cart
- **WHEN** the cart counts a product at Koramangala with `560034` stored and `560095`, which Koramangala also serves, is continued; and separately `560038` is continued with no counts
- **THEN** no dialog opens and the pincode is stored

### Requirement: Mobile store change outcome
"Switch store" SHALL clear the cart and then store the pincode; if the clear fails the dialog SHALL stay open showing "Could not empty your cart." and the pincode SHALL not change. "Keep cart", the Android back gesture and Escape SHALL keep the pincode and the cart.

#### Scenario: Store change confirmed
- **WHEN** the cart counts 2 of a product at Koramangala with `560034` stored, `560038`, which resolves to Indiranagar, is continued, and "Switch store" is chosen
- **THEN** the dialog "Switch to the Indiranagar store?" with "Your cart has 2 items from Koramangala" opens with "Keep cart" as its first button, and after the choice the cart counts nothing and the stored pincode is `560038`

#### Scenario: Store change kept
- **WHEN** the same continue is followed by "Keep cart"
- **THEN** the stored pincode is still `560034` and the product still shows 2

#### Scenario: Store change against core
- **WHEN** a browser with `560034` chosen adds a product on Home, continues with `560038` in the sheet, keeps the cart, continues with `560038` again, and switches
- **THEN** after "Keep cart" the header still reads "Delivering to 560034, Bengaluru" and the product's count is 1; after "Switch store" the heading reads "ShopperStop in 12 minutes" and the header "Delivering to 560038, Bengaluru", and axe reports no violations with the dialog open

### Requirement: Mobile dialogs
A dialog SHALL open as a modal centred on a dimmed backdrop that does not close it, named by its title, which SHALL be a level-2 heading. The Android back gesture and Escape on the web export SHALL call its close action. Its footer SHALL lay its buttons in one row of equal widths, the cancel button first by convention.

#### Scenario: Dialog named and closed by the platform
- **WHEN** a dialog titled "Switch to the Indiranagar store?" is open and the platform asks the modal to close
- **THEN** its modal carries the name "Switch to the Indiranagar store?", its title is a level-2 heading, and the close action is called once

#### Scenario: Footer keeps the order
- **WHEN** a dialog footer holds "Keep cart" and then "Switch store"
- **THEN** both buttons have the same width and "Keep cart" comes first

### Requirement: Mobile guest cart lines
While no customer token is held, setting a line of the guest cart SHALL set it to exactly the given quantity, clamped to the product's maximum (its `quantity` while in stock, at most 20; 0 when out of stock); 0 SHALL remove the line, and a cart whose last line goes SHALL have no store. At another store, a quantity above 0 after the clamp SHALL replace the cart with that one line; 0 SHALL leave it unchanged.

#### Scenario: Guest line set and removed
- **WHEN** an empty guest cart sets product P to 1 at store A, then P to 3, then product Q to 1, then P to 0
- **THEN** the cart is at store A holding only Q with quantity 1, and after Q is set to 0 the cart has no store and no lines

#### Scenario: Guest line clamped
- **WHEN** product P has `quantity` 4 and `inStock` true and is set to 6, and product R has `inStock` false and `quantity` 0 and is set to 1
- **THEN** P's line has quantity 4 and there is no line of R

#### Scenario: Another store replaces the guest cart
- **WHEN** a guest cart at store A holds P and Q, then R is set to 0 at store B, then R is set to 1 at store B
- **THEN** after the first set the cart is still at A with P and Q, and after the second it is at B holding only R

#### Scenario: Out of stock at another store keeps the guest cart
- **WHEN** a guest cart at store A holds P and Q, and R, which has `inStock` false and `quantity` 0, is set to 1 at store B
- **THEN** the cart is still at A with P and Q

### Requirement: Mobile guest cart storage
The app SHALL keep the guest cart `{storeId, items: [{product, quantity}]}` in memory and in async storage under `shopperstop:cart`, read once and asynchronously after launch; a change made before that read settles SHALL win over it. A stored value that does not parse as that shape SHALL read as an empty cart, and failing storage SHALL leave the cart in memory without an error.

#### Scenario: Guest cart persisted and restored
- **WHEN** a guest cart sets P to 2 at store A, and the cart module is loaded again; and in a third load async storage `shopperstop:cart` holds `{"items":5}`
- **THEN** async storage `shopperstop:cart` holds store A and P with quantity 2, the second load reads the same cart, and the third load reads the empty cart

#### Scenario: Guest change wins over a late read
- **WHEN** the stored cart holds P at store A, the read is still pending, and Q is set to 1 at store A
- **THEN** after the read settles the cart holds only Q, and async storage holds only Q

#### Scenario: Guest cart with blocked storage
- **WHEN** every async storage call rejects, the cart module loads and P is set to 1 at store A
- **THEN** nothing throws and the cart holds P with quantity 1

### Requirement: Mobile cart totals
The guest cart SHALL show the totals core computes for a server cart, from the resolved store's fees: `subtotalCents` the sum of price times quantity, `deliveryFeeCents` the store's fee or 0 at or above its free-delivery threshold, `totalCents` subtotal plus fee, `minOrderCents` the store's minimum, and `shortfallCents` what is missing to free delivery, never below 0. An empty cart SHALL have every amount 0.

#### Scenario: Guest totals follow the store's fees
- **WHEN** the store's fee is 2500, free delivery starts at 19900 and the minimum order is 9900, and the guest cart holds 2 of a product priced 4500
- **THEN** the cart shows `subtotalCents` 9000, `deliveryFeeCents` 2500, `totalCents` 11500, `minOrderCents` 9900 and `shortfallCents` 10900; with 5 of it, `deliveryFeeCents` 0, `totalCents` 22500 and `shortfallCents` 0

### Requirement: Mobile cart behind every Stepper
Every product `Stepper` (card, product screen, cart sheet line) SHALL show the product's quantity in the cart while the cart is at the resolved store, and 0 while the cart is empty or at another store, and SHALL set that line at the resolved store through the cart: the guest cart while no token is held, the server cart while one is.

#### Scenario: Card adds to the guest cart
- **WHEN** no token is held, an open store is resolved, and "Add Amul Taaza" is chosen on its card
- **THEN** the group "Quantity of Amul Taaza" shows 1 and async storage `shopperstop:cart` holds the store's id and the product with quantity 1

#### Scenario: Card shows the server cart
- **WHEN** a token is held and the customer's cart from `GET /me/cart` holds 3 of Amul Taaza at the resolved store
- **THEN** its card's group "Quantity of Amul Taaza" shows 3

#### Scenario: Card ignores a cart at another store
- **WHEN** a token is held, Koramangala is the resolved store, and the cart from `GET /me/cart` holds 3 of Amul Taaza at Indiranagar
- **THEN** its card shows the "Add Amul Taaza" button and no group "Quantity of Amul Taaza"

#### Scenario: Guest taps each count
- **WHEN** no token is held, an open store is resolved, and "Add Amul Taaza", "Add one Amul Taaza" and "Add one Amul Taaza" are chosen one straight after the other
- **THEN** the group "Quantity of Amul Taaza" shows 3 and async storage holds it with quantity 3

### Requirement: Mobile cart quick taps
While a token is held and a change to a line is still being written, that line's `Stepper` SHALL show the last quantity asked for, so every tap counts from the one before. The app SHALL send cart changes to core one at a time in the order made, MAY skip a change a later one for the same line has overtaken, and SHALL end showing core's latest answer. When a write fails, the `Stepper` SHALL return to the cart's count.

#### Scenario: Quick taps each count
- **WHEN** a token is held, the cart holds 1 of Amul Taaza at the resolved store, and "Add one Amul Taaza", "Add one Amul Taaza" and "Remove one Amul Taaza" are chosen before any answer arrives
- **THEN** the group "Quantity of Amul Taaza" shows 2, then 3, then 2, and the writes reach core one at a time

#### Scenario: Failed write returns to the cart's count
- **WHEN** a token is held, the cart holds 1 of Amul Taaza at the resolved store, core cannot be reached, and "Add one Amul Taaza" is chosen
- **THEN** the group shows 2 at once and 1 again once the write has failed

### Requirement: Mobile server cart
While a token is held, the app SHALL read the cart from `GET /me/cart` and change a line with `PUT /me/cart/items` `{storeId, productId, quantity}`, showing the lines and store that answer holds, never the ones it sent. While the last answer says `clamped: true`, the cart sheet SHALL show "Some quantities were lowered to what the store has." until the cart is next changed or read again.

#### Scenario: Answer wins over what was sent
- **WHEN** a token is held, "Add one Amul Taaza" sends quantity 4, and core answers the line with quantity 2 and `clamped: true`
- **THEN** the group "Quantity of Amul Taaza" shows 2 and the open cart sheet shows "Some quantities were lowered to what the store has."

#### Scenario: Line clamped away
- **WHEN** a token is held, the last `PUT /me/cart/items` answered an empty cart with `clamped: true`, and the cart sheet opens
- **THEN** it shows "Some quantities were lowered to what the store has." and "Your cart is empty"

### Requirement: Mobile cart write failure
While a token is held, a failed change to a line SHALL show a one-line alert under the control it was made from (product card, product screen bar, cart sheet line) with the answer's error message, or "Could not reach ShopperStop. Try again." when core was not reached. The alert SHALL go when that control is used again or leaves the screen; an overtaken change SHALL show none.

#### Scenario: Failed write tells the customer
- **WHEN** a token is held, the cart holds 1 of Amul Taaza at the resolved store, core cannot be reached, and "Add one Amul Taaza" is chosen on its card
- **THEN** the card shows an alert "Could not reach ShopperStop. Try again." and its group shows 1

#### Scenario: Core's refusal is shown
- **WHEN** core answers `PUT /me/cart/items` with 400 `validation` "product not available" and "Add one Amul Taaza" is chosen on the product screen
- **THEN** the product screen's bar shows an alert "product not available"

#### Scenario: Next tap clears the failure
- **WHEN** the card shows a failed write's alert and "Add one Amul Taaza" is chosen again
- **THEN** the alert is gone at once, and shows again when that write fails too

#### Scenario: Overtaken change shows no failure
- **WHEN** core cannot be reached and "Add one Amul Taaza" is chosen twice on the card before any answer arrives
- **THEN** once the writes have settled the card shows exactly one alert

### Requirement: Mobile cart merge at sign-in
When sign-in or register succeeds and the guest cart has lines, the app SHALL send `PUT /me/cart/items` for each guest line in the guest cart's order, with its store and quantity, before leaving the form, and then SHALL empty the guest cart, also when a request fails, and show core's cart as answered. A merge still queued when the session changes SHALL send nothing and keep the guest cart.

#### Scenario: Merge bodies in guest order
- **WHEN** the guest cart at store A holds P with 2 and then Q with 1, and sign-in succeeds
- **THEN** the app sends `{storeId: A, productId: P, quantity: 2}` and then `{storeId: A, productId: Q, quantity: 1}`, and P shows 2 from core's answer

#### Scenario: Guest cart discarded after merge
- **WHEN** the guest cart holds a line and the merge runs while core cannot be reached
- **THEN** afterwards async storage has no `shopperstop:cart` and the guest cart is empty

#### Scenario: Merge dropped when the session changed
- **WHEN** the guest cart holds a line, the merge waits behind another cart write, and the token has changed before its turn
- **THEN** no merge request is sent and the guest cart still holds its line

### Requirement: Mobile cart sheet
The cart SHALL open as a sheet titled "My cart" with: the delivery promise "Delivery in <N> minutes" and "Shipment of <count> items"; each line's image, name, unit, line price and a `Stepper` labelled with its name (out of stock: "Out of stock" and "Remove <name>"); "Add ₹<shortfall> more for free delivery." while above 0; "Bill details" with "Items total" (MRP total struck when higher), "Delivery fee" ("FREE" at 0) and "Grand total".

#### Scenario: Sheet lines and bill
- **WHEN** the sheet opens on a cart holding 2 of "Amul Taaza" (`500 ml`, 2700, MRP 2900) and 1 of "Amul Butter" (`100 g`, 5600) with fee 2500, free delivery from 19900, minimum 9900 and a 10-minute store
- **THEN** it shows "Delivery in 10 minutes", "Shipment of 3 items", both lines with their unit, "₹54" and "₹56" and a quantity group each, "Add ₹89 more for free delivery.", "Items total" ₹110 with the struck MRP total ₹114, "Delivery fee" ₹25 and "Grand total" ₹135

#### Scenario: Free delivery
- **WHEN** the cart's `deliveryFeeCents` and `shortfallCents` are 0
- **THEN** "Delivery fee" reads "FREE" and no "more for free delivery" text is shown

#### Scenario: Out-of-stock line
- **WHEN** the server cart holds a line of "Amul Butter" whose product has `inStock` false, and "Remove Amul Butter" is chosen
- **THEN** the line shows a disabled "Out of stock" button, and the choice sends quantity 0 for Amul Butter

### Requirement: Mobile cart checkout and minimum order
Below the sheet's scrolling content, at or above `minOrderCents` the sheet SHALL show a "Proceed to checkout" link with the grand total, to `/checkout`, or to `/sign-in?returnTo=%2Fcheckout` with no token, closing the sheet; below it, the block "Minimum order is ₹<min>. Add ₹<missing> more to check out." and no link. The sheet SHALL end its content with "Orders cannot be cancelled once packing starts."

#### Scenario: Below the minimum order
- **WHEN** the cart's subtotal is 5400 and `minOrderCents` 9900
- **THEN** "Minimum order is ₹99. Add ₹45 more to check out." is shown and there is no "Proceed to checkout" link

#### Scenario: Proceed signed out
- **WHEN** the sheet is open on a guest cart above the minimum and "Proceed to checkout" is chosen
- **THEN** the sheet closes and the app is at `/sign-in` with `returnTo` `/checkout`

#### Scenario: Proceed signed in
- **WHEN** a token is held, the sheet is open on a cart above the minimum, and "Proceed to checkout" is chosen
- **THEN** the sheet closes and the app is at `/checkout`

### Requirement: Mobile cart sheet states
The sheet SHALL show, for an empty cart, the empty state "Your cart is empty" with "Milk, bread, snacks and more, delivered from the store near you in minutes." and a "Start shopping" button that closes the sheet; a loading state while the server cart loads; and the error state with "Try again" when it fails to load and nothing is held.

#### Scenario: Empty cart
- **WHEN** the sheet opens on an empty guest cart and "Start shopping" is chosen
- **THEN** "Your cart is empty" is shown, and the choice closes the sheet

#### Scenario: Loading and failed cart
- **WHEN** the sheet opens signed in before `GET /me/cart` answers; and separately signed in with core unreachable
- **THEN** the label "Loading" is shown; then "You're offline" with a "Try again" button that reads the cart again

### Requirement: Mobile cart bar
While the cart has lines, Home, the Categories tab, the category screen and search SHALL show at their foot a bar with the item count ("1 item", "N items", the sum of quantities) and the total as `Price`, the whole bar one button named "View cart, <count>, <total>" that opens the cart sheet. The bar SHALL be absent while the cart is empty, and on every other screen.

#### Scenario: Bar follows the cart
- **WHEN** Home renders with an empty cart, and then with a cart of 2 of a product priced 2700 (fee 2500)
- **THEN** first no "View cart" button is shown; then the bar shows "2 items" and ₹79, and choosing it opens the sheet "My cart"

#### Scenario: Bar on the browsing screens
- **WHEN** the cart holds a line and the Categories tab, a category screen, search and a product screen render
- **THEN** the first three show the "View cart" button and the product screen does not

### Requirement: Mobile store change empties the server cart
While a token is held, "Switch store" in the store change dialog SHALL send `DELETE /me/cart` and show the empty cart once it answers; when the request fails the dialog SHALL stay open with "Could not empty your cart." and the pincode SHALL not change.

#### Scenario: Server cart emptied on a store change
- **WHEN** a signed-in customer's cart at Koramangala holds a line, `560038` is continued in the pincode sheet, and "Switch store" is chosen
- **THEN** `DELETE /me/cart` is sent, the stored pincode is `560038`, and the cart counts nothing

#### Scenario: Emptying the server cart fails
- **WHEN** the same switch is chosen while core cannot be reached
- **THEN** the dialog stays open with an alert "Could not empty your cart." and the stored pincode is still `560034`

### Requirement: Mobile store change needs an answer
"Continue" in the pincode sheet SHALL compare stores against the cart as known after its read settles (the stored guest cart, or `GET /me/cart` while a token is held). When the cart has lines, or cannot be read, and the pincode lookup fails or the cart read fails, the sheet SHALL stay open, store nothing and show the alert "Could not check this pincode. Try again."; with an empty cart a failed lookup SHALL store the pincode as before.

#### Scenario: Failed lookup keeps the cart's pincode
- **WHEN** the cart holds a line at Koramangala with `560034` stored, and `560038` is continued while `GET /serviceability` cannot be reached
- **THEN** no dialog opens, the sheet stays open with the alert "Could not check this pincode. Try again.", and the stored pincode is still `560034`

#### Scenario: Unread server cart is fetched before comparing
- **WHEN** a token is held, the cart is not yet read, `GET /me/cart` answers a line at Koramangala, and `560038` (Indiranagar) is continued
- **THEN** the dialog "Switch to the Indiranagar store?" opens

#### Scenario: Failed lookup with an empty cart
- **WHEN** the cart is empty and `560038` is continued while `GET /serviceability` cannot be reached
- **THEN** the pincode `560038` is stored and the sheet closes

### Requirement: Mobile cart replaced notice
When a `PUT /me/cart/items` answer says `replaced: true`, from a Stepper or the merge, the app SHALL open the cart sheet once, and the sheet and the cart bar SHALL show, until the cart is next changed or read again, a status "Your cart from <store> was replaced. A cart holds products from one store.", <store> being the name `GET /stores/{id}` gives for the cart's previous store, or "another store" while it is not known.

#### Scenario: Replaced notice names the old store
- **WHEN** a token is held, the cart was at Koramangala, and the last `PUT /me/cart/items` answered one line at Indiranagar with `replaced: true`
- **THEN** the cart sheet has opened, and it and the cart bar each show a status "Your cart from Koramangala was replaced. A cart holds products from one store."

#### Scenario: Replace opens the sheet once
- **WHEN** an answer with `replaced: true` arrives; then the customer closes the sheet; then an answer with `replaced: false` arrives
- **THEN** the sheet "My cart" opens on the first answer, stays closed after it is closed, and does not open on the second

#### Scenario: Replaced notice without the old store
- **WHEN** the same answer arrives while the previous store is not known
- **THEN** the status reads "Your cart from another store was replaced. A cart holds products from one store."

### Requirement: Mobile cart end-to-end suite
`e2e/cart.spec.ts` SHALL run the cart against core on the web export at 390×844 with axe on every screen and open sheet or dialog it visits.

#### Scenario: Guest cart against core
- **WHEN** a guest with `560034` chosen adds two products on Home, adds one more of the first, opens "View cart", removes both lines in the sheet and closes it, after a reload in between
- **THEN** the bar reads "3 items" before and after the reload, the sheet lists two lines with a "Proceed to checkout" link, then shows "Your cart is empty", and axe reports no violations with the bar, the sheet and the empty sheet

#### Scenario: Quick taps against core
- **WHEN** a signed-in customer with an empty cart chooses "Add" on a Home card and then "Add one", "Add one" and "Remove one" while core's first answer is held back
- **THEN** the card shows 2 and `GET /me/cart` answers that product with quantity 2

#### Scenario: Merge at sign-in against core
- **WHEN** a guest with `560034` chosen adds two products on Home, sets the first to 2, and signs in through the sheet's "Have an account?" link as a customer with an empty cart
- **THEN** on Home the first shows 2 and the second 1, and local storage has no `shopperstop:cart`

#### Scenario: Clamp against core
- **WHEN** a signed-in customer has 2 of a product, the store's stock of it drops to 1, and "Add one" is chosen on its product screen
- **THEN** its quantity shows 1 and the opened cart sheet shows "Some quantities were lowered to what the store has."

#### Scenario: Server store change against core
- **WHEN** a signed-in customer with `560034` chosen adds a product, continues with `560038` in the pincode sheet and chooses "Switch store"
- **THEN** no "View cart" button is shown, `GET /me/cart` answers the empty cart, and axe reports no violations with the dialog open

#### Scenario: Replaced notice against core
- **WHEN** a signed-in customer whose cart holds a product at Koramangala opens Home with `560038` chosen and chooses "Add" on a card
- **THEN** the sheet opens with "Your cart from Koramangala was replaced. A cart holds products from one store.", after closing it the bar reads "1 item" with the same status, and axe reports no violations with the sheet open and closed
