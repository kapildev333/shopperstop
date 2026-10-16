## Context

Core-P4-L2 put four routes and `Customer.emailVerified` on main (`accounts` "Customers verify their email", "Customers reset a forgotten password", "Mail is logged until a transport exists"). Core mails a bare code: 43 characters of base64url, the body's last word, through `LogMailer`, one `slog` JSON line on core's stdout `{"msg":"mail","to":...,"subject":...,"body":"... <code>"}`. Subjects: "Verify your ShopperStop email", "Reset your ShopperStop password". Web built the same flows in `web-account-security` (archived 2026-10-16); this change ports them, with one difference forced by the phone: the code is also a field (see Decision 2).

The app already has what the screens need: `api`, `call`, `useMe`, `unreachable`, `queryClient` in `src/api.ts`; `setToken`/`useToken` in `src/session.ts`; `splitError`, `useBack`, `Errors` in `src/screen-support.ts`; the sign-in and register screens in `src/auth-forms.tsx` (brand header, local `Alert`, `FormField`, byte check with `minBytes`/`maxBytes`); `StatusMessage`, `Card`, `Button`, `FormField`, `Text` in `src/ui/`; the account screen's header and its row-action alert (`Text accessibilityRole="alert" tone="danger"`).

Binding from earlier mobile changes (all still hold): tokens only from `src/ui/tokens.ts`; RNTL 14's `render`, `fireEvent`, `renderRouter` are async and awaited; a press whose server write the test holds is fired unawaited and the result is awaited with `waitFor`/`findBy`; a map-based `renderRouter` needs `QueryClientProvider` in its `_layout` (see `checkout-emptied.test.tsx`'s `Layout`); one navigating `renderRouter` test per file (expo-router keeps its navigation store at module level); no `level` option in `getByRole` (headings by name); sheets and dialogs get their dialog role on the web export only after the slide; muted text only on `surface`; dynamic routes 404 on a direct load of the static export (this change adds only static routes); openapi-fetch answers carry the envelope in `error.error`, and queries throw `error.error` so `ErrorBanner`'s `errorKind` works.

### web-app requirements mirrored

| mobile-app (this change) | web-app | difference |
|---|---|---|
| Mobile email verification card | Customer email verification banner | a `Card` holding the status and the button (mobile `StatusMessage` wraps its children in `Text`, so a button cannot sit inside it); "My account" first in content, checkout under the header |
| Mobile sends a verification email | Customer sends a verification email | sent state adds "Enter the code" (Decision 2); the failure alert is the account screen's red text line, not `ErrorBanner` (mobile's shows fixed offline/server copy, not the message) |
| Mobile verify-email screen, outcome, failures | Customer verify-email page, failures | code field when no `token`; "code" in place of "link" in the copy; "Continue" is a button that replaces with `/account` |
| Mobile forgot-password link | Customer forgot-password link | 44 pt tall |
| Mobile forgot-password screen, outcome | Customer forgot-password page, outcome | "Send reset code", "a reset code is on its way", plus "Enter the code" |
| Mobile reset-password screen, checks, outcome, refusals | Customer reset-password page, outcome, bad code | code field prefilled from `token`; a refused code shows under the field (the form stays) instead of a page-level alert; "Sign in" is a button |
| Mobile account security end-to-end | Customer account security end to end | verify by direct load of the link on the export; reset by the code typed in the app |

## Goals / Non-Goals

Goals: the card on "My account" and checkout, the send action, three public screens, the sign-in link, an e2e that walks verify and reset against the real core, and the e2e hygiene from the area plan's Found.

Non-goals: a link in the mail (core), a public resend for a signed-out customer (core has no route), the checkout's 409 `email_unverified` (mobile-P5-L2), any file outside `apps/mobile/`, a native deep-link test (no device runner in CI, D37 ceiling).

## Decisions

### 1. One card component, `src/verify-email-card.tsx`

Exports `VerifyEmailCard({ style }: { style?: StyleProp<ViewStyle> })`. All hooks first (`useMe()`, `useRouter()`, `useState` for `sent: boolean`, `pending: boolean`, `error?: string`), then `if (me.data?.emailVerified !== false) return null`. Otherwise `<View style={style}><Card><View style={{ gap: spacing.unit * 3 }}>…</View></Card></View>`:
- not sent: `<StatusMessage tone="warning">Verify your email to pay online</StatusMessage>`, `<Button variant="secondary" loading={pending} onPress={() => void send()}>Send verification email</Button>`, then `{error ? <Text accessibilityRole="alert" tone="danger">{error}</Text> : null}`;
- sent: `<StatusMessage tone="success">Verification email sent</StatusMessage>` and `<Button variant="secondary" onPress={() => router.push('/verify-email')}>Enter the code</Button>`.

`send`: `setPending(true); setError(undefined); const e = await call(() => api.POST('/me/email-verification')); setPending(false)`; `!e` → `setSent(true)`; `e.code === 'conflict'` → `await queryClient.invalidateQueries({ queryKey: ['me'] })` (the key is `['me', token]`; the prefix matches); else `setError(e.message)`. `secondary`, not `primary`: on checkout "Place order" stays the one green action.

Placement, no prop or context:
- `src/app/account.tsx`: `<VerifyEmailCard />` as the first child of the `ScrollView` content in `AccountContent`, before `<ProfileCard />` (the content's `gap: 12` spaces it).
- `src/checkout-screen.tsx`: `<VerifyEmailCard style={styles.cardPad} />` between the header's `SafeAreaView` and `{body}`, with `cardPad: { paddingHorizontal: spacing.unit * 3, paddingTop: spacing.unit * 3 }`. Every state of the screen (skeleton, error, empty, lines) gets it, and a verified customer's layout is unchanged because the component renders nothing.
Existing tests stay green unchanged: their fetch refuses `/me` or answers it without `emailVerified`, so the card renders nothing.

### 2. The code is a field as well as a link

Core mails a bare code, and on a phone nothing turns it into `shopperstop://verify-email?token=`: without a field a device customer could never verify. So both screens take the code as typed (`FormField` label "Code from the email", `autoCapitalize="none"`, `autoCorrect={false}`, `autoComplete="one-time-code"`, trimmed before sending), and both reach it in-app: the card's "Enter the code" after sending, the forgot screen's "Enter the code" after 202. The link still works (`token` in the URL) for when core mails one. The area plan named the field for reset only; verify gets it for the same reason (escalated in the lane report; cutting it is deleting the field and the two "Enter the code" buttons).

### 3. `/verify-email` uses `useQuery`, keyed by the code

Screen in its route file `src/app/verify-email.tsx` (as `account.tsx` is), default export `VerifyEmail`. `const { token } = useLocalSearchParams<{ token?: string }>()`; local state `typed` (the field), `entered?: string` (the code submitted from the field), `fieldError?: string`. The code is `entered ?? (token || undefined)`, computed each render (never copied into state at mount: on the static export the first render may not have the query yet).

`useQuery<true, ApiError>({ queryKey: ['verify-email', code], enabled: !!code, staleTime: Infinity, queryFn })`, `queryFn`: `const e = await call(() => api.POST('/auth/verify-email', { body: { token: code as string } })); if (e) throw e; await queryClient.invalidateQueries({ queryKey: ['me'] }); return true`. The cache dedupes a double mount, so the code is posted once (a second post would be refused, the code being spent). `retry: false` is the client default.

Layout: `View role="main"` on `canvas`, `<Head><title>Verify email · ShopperStop</title></Head>`, the account screen's header (`IconButton` "Back" with `useBack()`, `Text variant="h2" heading={1}` "Verify email"), then a `ScrollView` (`keyboardShouldPersistTaps="handled"`, content padding 12, gap 12) holding one `Card` with a gap-12 column. In it, in order:
- `verify.isSuccess`: `<StatusMessage tone="success">Your email is verified</StatusMessage>` and `<Button onPress={() => router.replace('/account')}>Continue</Button>`; nothing else.
- else if `code && verify.isPending`: `<StatusMessage>Verifying your email</StatusMessage>`.
- else if `verify.error?.field === 'token'`: `<Text accessibilityRole="alert" tone="danger">This code is invalid or has expired.</Text>`, then `token held ? <VerifyEmailCard /> : <Link href="/sign-in?returnTo=%2Faccount" style={link}>Sign in to get a new code</Link>` (link style: `colors.accent`, `fontFamily(600)`, `paddingVertical: 12`), then the form.
- else if `verify.error`: `<Text accessibilityRole="alert" tone="danger">{verify.error.message}</Text>` and `<Button variant="secondary" onPress={() => void verify.refetch()}>Try again</Button>`.
- else (no code): the form.
The form: `FormField` "Code from the email" (`value={typed}`, `error={fieldError}`, `returnKeyType="go"`, `onSubmitEditing={submit}`) and `<Button size="lg" onPress={submit}>Verify email</Button>`. `submit`: `const next = typed.trim()`; empty → `setFieldError('Enter the code from the email')`; else `setFieldError(undefined); setEntered(next)`. Re-entering a code already refused shows the cached refusal without a request (it would be refused again).
`VerifyEmailCard` inside sits on the card's `surface`; its own `Card` nests, which is acceptable (ceiling: flatten if the walk looks heavy).

### 4. Forgot and reset live in `src/auth-forms.tsx`

They are auth forms reached from sign-in and share its private pieces (`Back`, `Alert`, `styles`, `minBytes`, `maxBytes`), so they are added there as `ForgotPasswordScreen` and `ResetPasswordScreen`, with route files `src/app/forgot-password.tsx` and `src/app/reset-password.tsx` that re-export them (as `sign-in.tsx` does). No new shared helper.

Both: `View role="main"` on `surface`, `<Head><title>Forgot password · ShopperStop</title></Head>` / `Reset password · ShopperStop`, the `brand` header (`<Back label="Back" onBack={back} />`, `Text variant="display" tone="onBrand" heading={1}`, one `tone="onBrand"` line: "We'll email you a code to set a new password." / "Enter the code from the email and choose a new password."), then `ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}`, `errors.banner ? <Alert message={errors.banner} /> : null` first. State as `SignInScreen`: `Errors` (`{ fields, banner? }`) and `pending`.
- Forgot: `FormField` "Email" (as sign-in's, `returnKeyType="go"`, `onSubmitEditing={submit}`), `<Button size="lg" loading={pending} onPress={submit}>Send reset code</Button>`, then `<Link href="/sign-in" style={[styles.link, styles.linkRow]}>Back to sign in</Link>` (always shown). `submit`: empty after trim → `fields.email = 'Enter your email'`; else `call(() => api.POST('/auth/password-reset', { body: { email: email.trim() } }))`; `undefined` → `sent = true`; else `setErrors(splitError(error, ['email']))` (429 has no field, so it lands in the alert). `sent` replaces the field and button with `<StatusMessage tone="success">If that email has an account, a reset code is on its way</StatusMessage>` and `<Button onPress={() => router.push('/reset-password')}>Enter the code</Button>`.
- Reset: `const { token } = useLocalSearchParams<{ token?: string }>()`; `typed?: string` state; the field's value is `typed ?? token ?? ''` (never copied at mount, as in Decision 3). Fields: "Code from the email" (Decision 2 props), "New password" (`hint="8 to 72 characters"`, `secureTextEntry`, `autoComplete="new-password"`, `textContentType="newPassword"`), "Confirm password" (same, `returnKeyType="go"`, `onSubmitEditing={submit}`), `<Button size="lg" loading={pending} onPress={submit}>Set password</Button>`. Field keys `token`, `password`, `confirm`. `submit` collects every problem at once, as register does: code empty after trim → `token: 'Enter the code from the email'`; password empty → `password: 'Enter a new password'`, else bytes (`new TextEncoder().encode(p).length`) outside `minBytes..maxBytes` → `password: 'Use 8 to 72 characters'`, else `confirm !== password` → `confirm: 'Passwords do not match'`. Any problem → set them, send nothing. Else `call(() => api.POST('/auth/password-reset/confirm', { body: { token: code, password } }))`: `undefined` → `setToken(undefined); queryClient.clear(); done = true`; `error.field === 'token'` → `setErrors({ fields: { token: 'This code is invalid or has expired.' } }); codeRefused = true`; else `setErrors(splitError(error, ['password']))`. While `codeRefused`, `<Link href="/forgot-password" style={[styles.link, styles.linkRow]}>Request a new code</Link>` shows right under the code field. `done` replaces the form with `<StatusMessage tone="success">Your password is changed. Sign in with your new password.</StatusMessage>` and `<Button onPress={() => router.replace('/sign-in')}>Sign in</Button>`. No show-password toggle (web has none on reset; two password fields).
- Sign-in: `<Link href="/forgot-password" style={[styles.link, styles.linkRow]}>Forgot password?</Link>` right after the Password `FormField`, before the "Sign in" button. New style `linkRow: { alignSelf: 'flex-start', paddingVertical: 12 }` (20 pt line plus 24 makes the 44 pt target).

### 5. The e2e reads core's stdout from a file

As web (its Decision 5), within `apps/mobile`: `e2e/mail.ts` exports `coreLog = path.resolve(__dirname, '.tmp/core.log')` (the mobile e2e files are compiled as CommonJS; `global-setup.ts` already uses `__dirname`) and `mailedCode(email, subject): Promise<string>`, a copy of `apps/web/e2e/mail.ts`'s `newestCode` and `mailedCode` (poll 10 s; newest matching `mail` line; the body's last word; a missing file reads as empty). `playwright.config.ts` imports `coreLog`, runs `mkdirSync(path.dirname(coreLog), { recursive: true })` and changes core's command to `` `go run ./cmd/core > ${JSON.stringify(coreLog)}` `` (the shell's `>` empties it at each start; stdout was ignored before; stderr still reaches Playwright). `apps/*/e2e/.tmp/` is already in the root `.gitignore`. `make e2e` runs the web suite and then the mobile suite, each starting and stopping its own core, so each writes its own log.

`e2e/account-security.spec.ts`, two tests (pincode `560034` preset with `addInitScript` so the first-visit sheet does not cover the screen):
- `email verified against core`: `freshShopper`, `signedIn`, `goto('/account')`, the card's text, axe, "Send verification email", "Verification email sent", `mailedCode(email, 'Verify your ShopperStop email')`, `goto('/verify-email?token=' + code)` (a direct load: a static route, so it is served; this is the export check of the link), "Your email is verified", axe, "Continue", heading "My account", no "Verify your email to pay online".
- `password reset against core`: `freshShopper`, `goto('/sign-in')`, link "Forgot password?", URL `/forgot-password`, axe, Email, "Send reset code", the success text, `mailedCode(email, 'Reset your ShopperStop password')`, "Enter the code", URL `/reset-password`, axe, fill "Code from the email", "New password", "Confirm password", "Set password", the success text, axe, button "Sign in", URL `/sign-in`, sign in with `newpass123`, URL `/`, `localStorage` holds `shopperstop.customer-token`, then `request.post(`${core}/auth/sign-in`, { data: { email, password: 'password123' } })` answers 401.
The spec copies `core`, `tokenKey`, `pincodeKey`, `freshEmail`, `expectNoViolations`, `freshShopper`, `signedIn` from `checkout.spec.ts` (task 5 folds them into `support.ts`).

### 6. Hygiene: picks read once, helpers in `e2e/support.ts` (last task)

The area plan's Found: every suite resolves product picks from the live list at run time, so an order another spec places can shift an index; five spec files copy the same helpers (the extract point is `mobile-e2e-flow` design Decision 3; this change adds a sixth and seventh file, which is its trigger).

- `e2e/global-setup.ts`, after `seed-demo --reset` (Playwright starts `webServer` before `globalSetup`, so core is up): `fetch` `GET ${core}/stores/${koramangala}` (keep `minOrderCents`), `GET ${core}/stores/${koramangala}/products?page=2&pageSize=100`, and `GET ${core}/stores/${id}/products?pageSize=24` for Koramangala and Indiranagar; each must answer 200 (throw naming the URL otherwise). It stores `{ minOrderCents, page2: items, home: { [storeId]: items } }` (items as core answered them) as JSON in `process.env.SHOPPERSTOP_MOBILE_E2E_PICKS`; Playwright's workers inherit the runner's environment after global setup.
- `e2e/support.ts`: one module for every helper two or more spec files use, copied from the existing specs: constants `core`, `koramangala`, `indiranagar`, `tokenKey`, `pincodeKey`, `guestCartKey`, `admin`; `type Shopper = { token; headers; email; password }`; `freshEmail`, `expectNoViolations`, `freshShopper(request, name)`, `signedIn(page, shopper, pincode = '560034')`, `guest(page, pincode = '560034')`, `staffHeaders(request)` (the Koramangala store staff, as orders and flow use it), `adminHeaders(request)` (the admin, as cart and checkout call it `staffHeaders` today: their call sites are renamed), `fillCart`, `addAddress(request, shopper, label = 'Home', pincode = '560034')`, `serverCart`, `pincodeSheet` (the specs' `sheet`, renamed so cart's local `sheet` variables stay unambiguous), `savePincode`, `section`, `quantityOf`, `cartBar(page, count)` (`^View cart, ${count} item`), `cartSheet`, `openSearch`, `searchFor` (catalog's pair), and the picks: `orderPick(n)` returns `{ id, name, priceCents, unitLabel, units }` (the n-th `page2` item with `inStock`, `quantity === 10`, `priceCents >= 2000`; `units = Math.ceil(minOrderCents / priceCents)`; throws as today when missing) and `homePicks(minimum, storeId = koramangala)` (the names of `home[storeId]` in stock, first 12, `quantity >= minimum`); both synchronous, no request.
- Every spec imports from `./support` and drops its copies; call sites change only where a signature merged (`await orderPick(request, n)` → `orderPick(n)`, `await homePicks(request, m, s)` → `homePicks(m, s)`, flow's `cartBar(page, '7 items')` → `cartBar(page, '7')`, flow's one-call `searchFor` → `openSearch` then `searchFor`, cart and checkout `staffHeaders` → `adminHeaders`, `sheet` → `pincodeSheet`). No expectation, step or text changes. A helper only one spec uses stays in that spec (`demoShopper`, `placeByApi`, `registerInBrowser`, `storedToken`, `ensureClosedStore`, `listedProduct`, `proceedToCheckout`, `productLinks`). `e2e/mail.ts` stays its own file (the config imports it).

## Files

All in area `mobile`, under `apps/mobile/`:
- New: `src/verify-email-card.tsx`, `src/verify-email-card.test.tsx`, `src/app/verify-email.tsx`, `src/verify-email.test.tsx`, `src/verify-email-continue.test.tsx`, `src/verify-email-card-enter.test.tsx`, `src/app/forgot-password.tsx`, `src/app/reset-password.tsx`, `src/password-reset.test.tsx`, `src/password-forgot-link.test.tsx`, `src/password-forgot-sent.test.tsx`, `src/password-reset-sign-in.test.tsx`, `e2e/mail.ts`, `e2e/account-security.spec.ts`, `e2e/support.ts`.
- Changed: `src/app/account.tsx`, `src/checkout-screen.tsx`, `src/auth-forms.tsx`, `playwright.config.ts`, `e2e/global-setup.ts`, `e2e/accounts.spec.ts`, `e2e/catalog.spec.ts`, `e2e/cart.spec.ts`, `e2e/checkout.spec.ts`, `e2e/orders.spec.ts`, `e2e/flow.spec.ts`, `e2e/account-security.spec.ts`.
- Plus `openspec/changes/mobile-account-security/tasks.md` (ticks).

## Scenario to test

| Requirement › Scenario | Test file › test | Task |
|---|---|---|
| card › Unverified customer sees the card | `src/verify-email-card.test.tsx` › `unverified customer sees the card` | 1 |
| card › Verified customer sees no card | `src/verify-email-card.test.tsx` › `verified customer sees no card` | 1 |
| send › Verification email sent | `src/verify-email-card.test.tsx` › `verification email sent` | 1 |
| send › Already verified when sending | `src/verify-email-card.test.tsx` › `already verified when sending` | 1 |
| send › Sending fails | `src/verify-email-card.test.tsx` › `sending fails` | 1 |
| send › Enter the code opens the verify screen | `src/verify-email-card-enter.test.tsx` › `enter the code opens the verify screen` | 2 |
| verify screen › Empty code checked | `src/verify-email.test.tsx` › `empty code checked` | 2 |
| verify outcome › Email verified from the link | `src/verify-email.test.tsx` › `email verified from the link` | 2 |
| verify outcome › Email verified with a typed code | `src/verify-email.test.tsx` › `email verified with a typed code` | 2 |
| verify outcome › Continue opens the account | `src/verify-email-continue.test.tsx` › `continue opens the account` | 2 |
| verify failures › Expired code while signed in | `src/verify-email.test.tsx` › `expired code while signed in` | 2 |
| verify failures › Expired code while signed out | `src/verify-email.test.tsx` › `expired code while signed out` | 2 |
| verify failures › Verification unreachable then retried | `src/verify-email.test.tsx` › `verification unreachable then retried` | 2 |
| forgot link › Forgot-password link on sign-in | `src/password-forgot-link.test.tsx` › `forgot-password link on sign-in` | 3 |
| forgot screen › Empty email checked | `src/password-reset.test.tsx` › `empty email checked` | 3 |
| forgot outcome › Reset code requested | `src/password-reset.test.tsx` › `reset code requested` | 3 |
| forgot outcome › Enter the code opens the reset screen | `src/password-forgot-sent.test.tsx` › `enter the code opens the reset screen` | 3 |
| forgot outcome › Malformed email from core | `src/password-reset.test.tsx` › `malformed email from core` | 3 |
| forgot outcome › Too many reset requests | `src/password-reset.test.tsx` › `too many reset requests` | 3 |
| reset screen › Code from the link | `src/password-reset.test.tsx` › `code from the link` | 3 |
| reset checks › Reset form checks fields | `src/password-reset.test.tsx` › `reset form checks fields` | 3 |
| reset outcome › Password reset | `src/password-reset.test.tsx` › `password reset` | 3 |
| reset outcome › Sign in after the reset | `src/password-reset-sign-in.test.tsx` › `sign in after the reset` | 3 |
| reset refusals › Password refused by core | `src/password-reset.test.tsx` › `password refused by core` | 3 |
| reset refusals › Expired reset code | `src/password-reset.test.tsx` › `expired reset code` | 3 |
| e2e › Email verified against core | `e2e/account-security.spec.ts` › `email verified against core` | 4 |
| e2e › Password reset against core | `e2e/account-security.spec.ts` › `password reset against core` | 4 |
| picks › Picks answer from the setup read | every `e2e/*.spec.ts` under `make e2e` (the mobile suite green with `orderPick`/`homePicks` from `support.ts`) | 5 |

## Test strategy

Jest with `fakeCore` from `src/fake-core.ts` (routes keyed `"METHOD /path"`, the returned list of requests for "exactly one" and body checks via `await request.clone().json()`); unreachable core is `jest.setup.ts`'s default refusing fetch or a handler that throws `TypeError`. The customer for `/me` is `{ id, email, name, emailVerified }`. Non-navigating screen tests: the card through `Account` and `CheckoutScreen` rendered under `QueryClientProvider` with no router (as `account.test.tsx` and `checkout-screen.test.tsx` do); the verify and reset screens through a map-based `renderRouter({ _layout: Layout, 'verify-email': VerifyEmail }, { initialUrl })` with `Layout` = `QueryClientProvider` around `Stack`. Navigating scenarios each in their own file through `renderRouter(appDir, { initialUrl })` with the real route files (the root layout provides the query client; `jest.mock('@expo-google-fonts/inter', …)` as in `account-sign-out.test.tsx`). Links are checked with `toHaveProp('href', …)` where the scenario does not press them. The e2e scenarios run in `make e2e` against the real core with axe on every screen they visit.

## Contract audit

Against `services/core/openapi.json` on main (`core.d.ts` has every route and `Customer.emailVerified: boolean`, required):
- `POST /me/email-verification` 202 (no body), 401, 409: used as documented. Gap (minor, core): no 429 is documented, so a customer can make core mail without limit; the app does not throttle either.
- `POST /auth/verify-email` `{token}` 204, 400 field `token`: used as documented.
- `POST /auth/password-reset` `{email}` 202, 400 field `email`, 429: used as documented.
- `POST /auth/password-reset/confirm` `{token, password}` 204, 400 field `password` or `token`: used as documented; 204 ends every session, so the app drops its token.
- Gap (core, not blocking): the mail carries a bare code and no link, so `shopperstop://verify-email?token=` and `/reset-password?token=` are reached only by typing; Decision 2's field is the workaround. One mail can hold one link; a link that works on both a phone and the web needs an https origin both handle (universal links or app links), a core and platform decision. Web-P5-L1 already asked core for a web link.
- Gap (core, not blocking): no public resend for a signed-out customer with an expired verification code (the screen offers sign-in instead, as web does).

## Risks / Trade-offs

- [Static export and query params] `/verify-email` and `/reset-password` are static routes, exported as `verify-email.html` and `reset-password.html`, so a direct load is served. Probed on 2026-10-16: a direct load of `/sign-in?returnTo=%2Fcheckout` on the served export hydrated with the query read (the "Create an account" link carried it). The code is read from the URL each render, never copied at mount, so a first render without the query cannot lose it. The e2e's direct load of `/verify-email?token=` is the standing check.
- [Device deep link] `shopperstop://verify-email?token=` relies on Expo Router's built-in linking with the `shopperstop` scheme from `app.json`; RNTL covers the route with `initialUrl`, and no CI runner opens a native URL (D37 ceiling). The manager's device walk is blocked on the owner's Accessibility grant (area plan Found); until then the link is unverified on a device.
- [`reuseExistingServer` outside CI] a core already on 18080 is reused and writes nothing to `core.log`; `mailedCode` fails after 10 s naming the file. `make e2e` starts a fresh core per suite.
- [The log carries live codes] gitignored `e2e/.tmp/`, `_e2e` database only.
- [One more `/me` read on checkout] shared with the account's cached key `['me', token]`; at most one request per checkout visit.
- [Picks through the environment] if a later Playwright stops passing the runner's environment to workers, `support.ts` throws "global setup did not hand over the picks" on first use; the fix is a JSON file under `e2e/.tmp/`.

## Ceilings

- `ponytail:` no resend on the sent card; a second send needs the screen opened again.
- `ponytail:` the verify query has `staleTime: Infinity` and (R1, F1) `retryOnMount`, `refetchOnMount` and `refetchOnWindowFocus` off, so a code is posted once per screen life even after a refusal and a remount; retyping the same code is the explicit resend (`verify.refetch()`). Reopening the same link within the cache's life shows the cached outcome.
- `ponytail:` no show-password toggle on reset; add one if the walk finds two blind fields hard.
- `ponytail:` the card's send has no same-tick guard (the button is disabled once `pending` renders); two sends at most mail two codes, the newest wins in core.
- `ponytail:` `support.ts` is one flat module; split by theme if it passes about 300 lines.
