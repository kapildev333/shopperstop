# rider-P5-L3-T4 - offers read while online, the offer sheet, decline (task 4 of rider-app-dispatch)
Status: brief

## Brief
- LANE-ID: rider-P5-L3 (task T4). Area: rider. Model: worker. Starts after T3 is committed.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/rider-P5-L3`, branch `lane/rider-P5-L3-app-dispatch`. Commit as `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no trailers. Never push. Never run `make e2e`, `make db`, `make dev` or `docker`.
- Scope (edit only these): `apps/rider/src/dispatch.tsx`, `apps/rider/src/routes/__root.tsx`, `apps/rider/src/offer.test.tsx` (new), `openspec/changes/rider-app-dispatch/tasks.md` (tick 4.1, 4.2), this file (log).
- Change and task: `openspec/changes/rider-app-dispatch/`, task 4. Scenarios: "Offers read while online" (Offline sends no offer read, Polled every 3 seconds), "Offer sheet" (Offer shown, Offer expires), "Decline an offer" (Decline closes the sheet). Read design.md Decisions 5 to 8 and 10.
- Setup: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; `test -d node_modules || npm ci`.

### Commit 1, `test: offers read while online, offer sheet, decline`
`src/offer.test.tsx` (new). Same `beforeEach`/`afterEach` as `availability.test.tsx` (token, fake timers with `shouldAdvanceTime: true`, `fakeGeolocation()`: an online rider without one goes offline). Routes: `signedInRoutes()` with `GET /api/rider/v1/me` answering `{...arjun, isOnline: true}` (or `arjun` for the offline test), empty ready list and deliveries, `PUT /api/rider/v1/me/location` → 204, `GET /api/rider/v1/me/offer` per test, `POST /api/rider/v1/me/offers/<id>/decline` → 204 and counted.
- `offline sends no offer read`: offline rider on `/`; the "Ready to pick up" heading shows; advance 10 s; no call to `/me/offer`.
- `polled every 3 seconds`: online rider, offer answers `json(204)`; one offer read soon after the page renders; advance 3 s; two; `screen.queryByRole('dialog')` is null.
- `offer shown`: offer answers `json(200, offer())`; `findByRole('dialog', { name: 'New order SS-AAAA0001' })`; within it the texts "3 items", "560034" (inside "Pincode 560034"), "₹339", "Cash", "30 s left", and buttons "Accept" and "Decline".
- `offer expires`: the offer answers the same `offer()` every time; the dialog shows; `await act(() => vi.advanceTimersByTimeAsync(30_000))`; no dialog; a `status` with "Offer expired"; advance 6 s more; still no dialog.
- `decline closes the sheet`: offer `o1 = offer()` until its decline is called, then `o2 = offer({ id: '00000000-0000-4000-8000-000000000b02', number: 'SS-AAAA0002' })`. Press "Decline" in "New order SS-AAAA0001": that dialog closes; the dialog "New order SS-AAAA0002" opens at a later poll; `await user.keyboard('{Escape}')`: it closes; each decline route was called once; advance 6 s: no dialog opens again.
Red: all but `offline sends no offer read` fail (that one may pass already; say so in the log, it guards the offline path). Commit with your log.

### Commit 2, `feat: offer sheet with countdown and decline`
In `src/dispatch.tsx`, `export function OfferSheet()`:
- `online = useQuery(meQuery).data?.isOnline ?? false`.
- The offer query (design Decision 5): `queryKey: ['rider', 'offer']`, `enabled: online`, `refetchInterval: 3_000`, `gcTime: 0`, `retry: false`; the function does `const { data, error, response } = await rider.GET('/me/offer')`, throws `error.error` on error, returns `response.status === 204 ? null : (data ?? null)`. A failed read shows nothing. `// ponytail:` polling every 3 s, no push or SSE (D57).
- State: `answered?: string` (Decision 6) and `status?: string`. `open = online && offer != null && offer.id !== answered`.
- `decline(o)`: `setAnswered(o.id)`, `setStatus(undefined)`, then `void rider.POST('/me/offers/{id}/decline', { params: { path: { id: o.id } } }).catch(() => undefined)` (fire and forget, Decision 8, with a `// ponytail:` comment: a failed decline lets the offer run out its 30 s).
- `<Sheet open={open} onClose={() => offer && decline(offer)} title={`New order ${offer.number}`}>` (title `''` when there is no offer) with a body component keyed by `offer.id` so the countdown restarts per offer:
  - lines as on the ready card: `itemCount(offer.itemCount)`, `Pincode <span className="tabular-nums">{offer.pincode}</span>`, `<Price cents={offer.totalCents} />`, `<Badge>Cash</Badge>` for `cod`;
  - seconds left = `Math.max(0, Math.ceil((Date.parse(offer.expiresAt) - Date.now()) / 1000))`, refreshed by a 1 s interval, shown as `<span className="tabular-nums">{n} s left</span>`, in no live region (Decision 7; `// ponytail:` device clock against the server's `expiresAt`);
  - at 0: `setAnswered(offer.id)` and `setStatus('Offer expired')` (call it from the interval callback or an effect event, not from render);
  - `<Button size="lg" className="w-full">Accept</Button>` (no handler yet; task 5 wires it) and `<Button size="lg" variant="secondary" className="w-full" onClick={() => decline(offer)}>Decline</Button>`.
- Outside the sheet: `{!open && status && <StatusMessage tone="warning">{status}</StatusMessage>}` (every close path sets `status`, so no effect clears it).
- `src/routes/__root.tsx`: render `<OfferSheet />` first inside `<main>`, before `<Outlet />`, only while `me` is set (wrap main's content in a `flex flex-col gap-4` only if the status line needs spacing; keep the page's own layout).
- Gates (paste tails): `npm run lint --workspace apps/rider`, `npm run typecheck --workspace apps/rider`, `npm run test --workspace apps/rider -- --run`, `npm run build --workspace apps/rider`, `openspec validate --all --strict`. Tick 4.1 and 4.2. Commit.

Stop and report under Blockers if `Sheet` cannot be used as above without a change in `packages/ui`.

## Log
