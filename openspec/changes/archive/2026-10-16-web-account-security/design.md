## Context

Core-P4-L2 put four routes and `Customer.emailVerified` on main (`accounts` "Customers verify their email", "Customers reset a forgotten password", "Mail is logged until a transport exists"). Core mails a bare code (the body's last word) through `LogMailer`, which writes one `slog` JSON line to core's stdout: `{"msg":"mail","to":...,"subject":...,"body":"... <code>"}`. Subjects: "Verify your ShopperStop email" and "Reset your ShopperStop password".

The web app already has everything the pages need: `api`, `call`, `splitError`, `useMe`, `unreachable` in `src/api.ts`; `setToken`/`useToken` in `src/session.ts`; `queryClient`; the `SignInForm` pattern in `src/auth-forms.tsx` (local `Errors` state, `FormField` + `Input`, `ErrorBanner` for non-field errors); TanStack file routes with `validateSearch` (see `routes/sign-in.tsx`); tests via `renderAt(path)` from `src/test-data.ts` and `vi.stubGlobal('fetch', ...)` with `Request` objects (see `checkout.test.tsx`).

Playwright starts core as a webServer with `shell: true` and ignores its stdout (only the runner process could pipe it, never a test worker). So the suite cannot read core's log unless the command writes it somewhere.

## Goals / Non-Goals

Goals: the banner, the send action, three public pages, the sign-in link, and an e2e that walks verify and reset against the real core.

Non-goals: mail transport or a link in the mail (core), a code-entry field on the pages, the checkout's 409 `email_unverified` (web-P5-L2), any `packages/ui` change.

## Decisions

1. **One banner component, `src/verify-email-banner.tsx`**, exporting `VerifyEmailBanner()`. It reads `useMe()`; it renders nothing unless `me.data?.emailVerified === false`. Inside: local state `sent: boolean`, `pending: boolean`, `error?: string`.
   - Not sent: `<StatusMessage tone="warning" className="flex-wrap">Verify your email to pay online <Button size="compact" loading={pending} onClick={send}>Send verification email</Button></StatusMessage>`, then `{error && <ErrorBanner message={error} />}` below it (wrap both in a `div` with `flex flex-col gap-2`).
   - Sent: `<StatusMessage tone="success">Verification email sent</StatusMessage>`.
   - `send`: `const e = await call(() => api.POST('/me/email-verification'))`; `undefined` → `sent = true`; `e.code === 'conflict'` → `await queryClient.invalidateQueries({ queryKey: ['me'] })` (banner goes when `/me` answers true); else `error = e.message`.
   - Placed in `routes/account.tsx` between `PageHeader` and the cards grid, and in `checkout.tsx`'s `Frame` right after its `PageHeader` (so every checkout state carries it). No prop, no context.
   - Existing tests stay green because their fetch fails or answers only the cart: `/me` errors and the banner renders nothing.

2. **`/verify-email` uses `useQuery`, not an effect.** `routes/verify-email.tsx`, `validateSearch: (s) => (typeof s.token === 'string' && s.token ? { token: s.token } : {})`. With a token: `useQuery({ queryKey: ['verify-email', token], queryFn, staleTime: Infinity })`, where `queryFn` runs `call(() => api.POST('/auth/verify-email', { body: { token } }))`, throws the `ApiError` when there is one, else `await queryClient.invalidateQueries({ queryKey: ['me'] })` and returns `true`. The query cache dedupes StrictMode's double mount, so the code is posted once (a second post would answer 400 and show a false failure). Rendering inside `Card className="mx-auto w-full max-w-md p-6"` under `PageHeader title="Verify email"`:
   - pending: `<StatusMessage>Verifying your email</StatusMessage>`;
   - success: `<StatusMessage tone="success">Your email is verified</StatusMessage>` and `<Link to="/account" className={buttonClass({})}>Continue</Link>`;
   - error with `field === 'token'`, or no token in the URL: `<ErrorBanner message="This verification link is invalid or has expired." />`, then `token held ? <VerifyEmailBanner /> : <Link to="/sign-in" search={{ returnTo: '/account' }}>Sign in to get a new link</Link>` (styled `text-accent underline` like sign-in's link);
   - other error: `<ErrorBanner message={error.message} onRetry={() => void query.refetch()} />`.
   The query client's `retry: false` default holds.

3. **Two forms in their route files**, `routes/forgot-password.tsx` and `routes/reset-password.tsx`, written like `SignInForm` (`noValidate`, `FormData`, `Errors` = `{ fields, banner? }`, `splitError`, `Button type="submit" size="lg" className="w-full" loading={pending}`), each page `PageHeader` + `Card className="mx-auto w-full max-w-md p-6"`. No shared form helper: two forms, copied five lines each.
   - Forgot: field "Email" (`name="email" type="email" autoComplete="email"`), button "Send reset link", below the card's form `<p>` with `Link to="/sign-in"` "Back to sign in". Empty after trim → "Enter your email". `call(() => api.POST('/auth/password-reset', { body: { email } }))`; `undefined` → `sent` state replaces the form with the success `StatusMessage` (the "Back to sign in" link stays); else `setErrors(splitError(error, ['email']))` (429 has no field, so it lands in the banner).
   - Reset: `validateSearch` as in decision 2. No token → `ErrorBanner` + "Request a new link" link only. Fields "New password" (`name="password"`, `autoComplete="new-password"`, hint "8 to 72 characters") and "Confirm password" (`name="confirm"`, `autoComplete="new-password"`), button "Set password". Checks in order: empty → "Enter a new password"; `new TextEncoder().encode(p).length` outside 8..72 → "Use 8 to 72 characters"; `confirm !== password` → `fields.confirm = 'Passwords do not match'`. On `undefined`: `setToken(undefined); queryClient.clear()`, `done` state shows the success `StatusMessage` and `<Link to="/sign-in" className={buttonClass({})}>Sign in</Link>`. On `error.field === 'token'`: `badCode` state shows the `ErrorBanner` "This reset link is invalid or has expired." and the "Request a new link" link above the form (form kept). Else `splitError(error, ['password'])`.

4. **Sign-in link through a slot, not a router import in the form.** `SignInForm` gains an optional prop `forgotPassword?: ReactNode` rendered right after the password `FormField`; `routes/sign-in.tsx` passes `<Link to="/forgot-password" className="self-start text-body text-accent underline">Forgot password?</Link>`. `auth-forms.test.tsx` renders `SignInForm` outside a router, which a `Link` inside the form would break.

5. **The e2e reads core's stdout from a file.** `apps/web/e2e/mail.ts` exports `coreLog = fileURLToPath(new URL('./.tmp/core.log', import.meta.url))` (`apps/*/e2e/.tmp/` is gitignored) and `mailedCode(email: string, subject: string): Promise<string>`: `expect.poll` (timeout 10 s) over `readFileSync(coreLog, 'utf8')` split by line, each `JSON.parse`d in a `try`, keeping lines with `msg === 'mail'`, `to === email`, `subject === subject`; the newest one's `body.split(' ').at(-1)`. A missing file reads as empty. `playwright.config.ts` imports `coreLog`, runs `mkdirSync(dirname(coreLog), { recursive: true })`, and changes core's command to `` `go run ./cmd/core > ${JSON.stringify(coreLog)}` `` (the shell's `>` empties it at each start; stdout was ignored before, so nothing is lost; stderr, where `go run` reports build failures, still reaches Playwright). This is a process-boundary read of the log line `accounts` specifies; no core change, no database read. `e2e/account-security.spec.ts` uses `freshShopper`, `signedIn`, `expectNoViolations` from `e2e/shopper.ts` and the pincode `beforeEach` of the other specs.

## Files

`apps/web/src/verify-email-banner.tsx` (new), `apps/web/src/verify-email-banner.test.tsx` (new), `apps/web/src/routes/account.tsx`, `apps/web/src/checkout.tsx`, `apps/web/src/routes/verify-email.tsx` (new), `apps/web/src/verify-email.test.tsx` (new), `apps/web/src/auth-forms.tsx`, `apps/web/src/routes/sign-in.tsx`, `apps/web/src/routes/forgot-password.tsx` (new), `apps/web/src/routes/reset-password.tsx` (new), `apps/web/src/password-reset.test.tsx` (new), `apps/web/src/routeTree.gen.ts` (regenerated by the router plugin on `vitest`/`vite build`), `apps/web/playwright.config.ts`, `apps/web/e2e/mail.ts` (new), `apps/web/e2e/account-security.spec.ts` (new), `openspec/changes/web-account-security/tasks.md` (ticks). All in area `web`.

## Test strategy

Vitest with `renderAt` and a `vi.stubGlobal('fetch', ...)` that routes on `new URL(request.url).pathname` and `request.method`, recording requests (`await request.clone().json()` for bodies) for the "exactly one request" assertions; the `me` answer comes from the stub (`/api/core/v1/me`) as `{ id, email, name, emailVerified }`. Unreachable core = the stub throws `TypeError` (as `test-setup.ts` does by default). The e2e scenarios under "Customer account security end to end" run in `make e2e` against the real core and assert axe on each page visited.

## Risks / Trade-offs

- [The pages say "link" but core mails a bare code] → until core puts `<origin>/verify-email?token=<code>` and `/reset-password?token=<code>` in the body, a person reaches the pages only by typing the URL; the e2e builds the URL itself. Requested of core in the lane report.
- [`reuseExistingServer` outside CI] → a core already listening on 18080 is reused and writes nothing to `core.log`; `mailedCode` then fails after 10 s with a message naming the file. `make e2e` and CI start a fresh core.
- [The log carries live codes] → it is under the gitignored `e2e/.tmp/`, only for the `_e2e` database.
- [The banner reads `/me` on `/checkout`] → one more request per checkout visit, shared with the header's cached `/me` query (same key), so usually none.

## Ceilings

- `ponytail:` no code-entry field on either page; add one if core keeps mailing bare codes after a real transport lands.
- `ponytail:` "Verification email sent" has no resend; a second send needs a reload. Add a "Send again" if customers ask.
- `ponytail:` signed-out resend on `/verify-email` is a sign-in link, not a public resend route (core has none).
- `ponytail:` `/verify-email`'s query has `staleTime: Infinity` and the default `gcTime` (5 minutes), so reopening the same link within about 5 minutes shows the cached outcome without posting again (a success stays a success; a failure is read again on mount because it holds no data). Set `gcTime: 0` if a re-post on every open is ever wanted.
