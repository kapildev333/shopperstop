# admin-P3-L1-R3 - review of task 4 (the riders page against the rider service) (reviewer)
Status: done

## Verdict
Approve with nits. No correctness, security or scope finding blocks task 5. (R2's board total bug is task 3b and not repeated.)

## Gates (run by me in /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P3-L1-review, HEAD 752d935, Node 22.23.3)
- `npm ci`: ok.
- `make test-web`: exit 0. ui 30 files / 83 tests, admin 27 files / 322 tests, web 26 files / 153 tests. Admin matches the worker's `322 passed (322)`.
- `openspec validate admin-riders --strict`: "Change 'admin-riders' is valid".
- Test-first, run by me: at 269ec2e (riders.test, rider-dialog.test, shell.test) `Tests 25 failed | 9 passed (34)`, 3 files failed, matching the worker's 25 failed. Reasons are right: nav lacks Riders (4 links, not 8/4), `/riders` route absent (stays on `/riders` instead of reaching a page: "Unable to find 'No riders yet'", "Edit arjun@example.test", the alert, the 130-total text), the 401 test sees the path unchanged. HEAD restored; tree clean.
- Not run: `make e2e`, Playwright, docker, `make db`, `make dev`.

## Spec coverage
- Every `admin-riders` scenario except the e2e one (task 5) has a named test (riders.test.tsx 7 tests / 8 runs, rider-dialog.test.tsx 10 tests / 15 runs); names match design.md "Tests". Both Role-based navigation scenarios are in shell.test.tsx (Riders after Stock for both roles). "Rider client calls the page's origin" is pinned by the `/api/rider/v1/admin/riders` fake keys plus `riderLists` query assertions (`{pageSize:'100'}`, `{pageSize:'100', store}`, never `store=nope`).
- Contract (services/rider/openapi.json): GET `store`/`pageSize` (max 100) uuid, POST body `storeId,email,name,password,phone?` (phone only when typed), PATCH `name,phone("" clears),isActive,password` only what differs, 409 `conflict` with `field: email`, 400 `validation` with field, 403 and 502 go to the banner. The code matches field for field. Store staff never send `store` (so the 403 on a foreign store cannot arise) and POST with their own `storeId`.
- Second client reuses the middleware rule: one `staffSession` Middleware object registered on both clients (token header, 401 to the current token ends the session, envelope-less failures become `internal`). A single shared rule, nothing duplicated. 401 test passes.
- Store selector state is in the URL (`validateSearch` + `navigate({search})`), "All stores" removes the key, an unknown `store` is clamped to all and never sent. Riders query is disabled until the stores list answers for admins, so a bad `store` is never sent even for one request.
- Dialog: `Dialog` from ui (focus trap, Escape, Cancel first via `DialogFooter`); submit button `aria-disabled` and never `disabled`; `edit()` calls `reset()` only when not pending; `close` ignored while pending; password body dropped from the mutation cache (`gcTime: 0`); labels via `FormField`; the page's `rider` is re-read from the list so the dialog never edits a stale row. Matches the standing rules in the area plan.
- Config: `/api/rider` before `/api` in both dev (8081/8080) and preview (18081/18080) proxies (Vite uses the first matching key). Playwright adds `go run ./cmd/rider` on :18081 with healthz `/api/rider/v1/healthz` (servers prefix is `/api/rider/v1`, confirmed in openapi.json), `reuseExistingServer` as for core. global-setup runs `core-admin` then `rider-admin` migrate and `seed-demo --reset` with the inherited env. `make -n e2e`/E2E_ENV: rider db `shopperstop_rider_e2e`, `:18081`, core URL `:18080`, same service token as core's `SERVICE_TOKENS`, rider web origins include 15174. Consistent. `deploy/Caddyfile` already has `/api/rider/*`.
- `routeTree.gen.ts`: only the `/riders` lines. Task ticks 4.1/4.2 only.

## Findings
1. NIT, `apps/admin/src/rider-dialog.tsx:78-80`. `apiError.field in messages` is true for inherited names (`toString`, `constructor`): such a `field` makes `field` truthy, `fieldError` a function or undefined... for a `validation` answer `messages['constructor']` is a function, `errorFor` never matches a real field, and `!fieldError` is false, so no banner shows and nothing is said. The rider service only sends the five field names, so this is not reachable today. Smallest fix if wanted: `Object.hasOwn(messages, apiError.field)`.
2. NIT, `rider-dialog.tsx:16`. The password message says "8 to 72 characters", the service counts bytes ("8 to 72 bytes" in RiderCreate). A 30-character password of 3-byte characters is refused with a message that looks wrong. Text is the spec's wording; changing it is a spec edit, so record only.
3. NIT, test gap. The "Saving..." scenario is tested on create only; edit shares the same button and `submit`, so it is covered by construction. The refusal and banner scenarios likewise run on create. Accepted.
4. NIT, `routes/_staff/riders.tsx` retry. `onRetry` calls `riders.refetch()` even while the query is disabled (stores not yet loaded); it then fetches the unfiltered list, which is what the clamp would send anyway. Harmless.

## Scope and complexity
Files touched equal the brief's scope list plus the worker log. `riders.ts` (one query, `ponytail:` names the 100 ceiling), the single `staffSession` middleware and the dialog are the minimum. No speculative abstraction, no new dependency.
