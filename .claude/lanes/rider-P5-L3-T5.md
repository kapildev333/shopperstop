# rider-P5-L3-T5 - accept an offer (task 5 of rider-app-dispatch)
Status: brief

## Brief
- LANE-ID: rider-P5-L3 (task T5). Area: rider. Model: worker. Starts after T4 is committed.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/rider-P5-L3`, branch `lane/rider-P5-L3-app-dispatch`. Commit as `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no trailers. Never push. Never run `make e2e`, `make db`, `make dev` or `docker`.
- Scope (edit only these): `apps/rider/src/dispatch.tsx`, `apps/rider/src/offer.test.tsx`, `apps/rider/src/fake-geolocation.ts` and `apps/rider/src/availability.test.tsx` (R3 finding only, section 0), `openspec/changes/rider-app-dispatch/tasks.md` (tick 5.1, 5.2), this file (log).
- Change and task: `openspec/changes/rider-app-dispatch/`, task 5. Scenarios: "Accept an offer" (Accepted, Someone else took it, Accept fails). Read design.md Decision 9.
- Setup: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; `test -d node_modules || npm ci`.

### 0. R3 finding first (T3 review, `.claude/lanes/rider-P5-L3-R3.md`), scenario "Position reported while online"
`fakeGeolocation` ignores the options, so swapping `useOnlineReport`'s `{ enableHighAccuracy: false, maximumAge: 10_000 }` would still pass.
Commit 0, `test: online position watch uses low accuracy and a 10 s maximum age`:
- `src/fake-geolocation.ts`: `watchPosition(success, failure?, options?)` stores `options` in its `Watch` entry; add `options: () => [...watches.values()].map((watch) => watch.options)` to the returned object. Nothing else changes; every existing test stays green.
- `src/availability.test.tsx`, test `online watch options`: an online rider opens `/history` (no delivery page, so the only watch is the online one); once `geo.watching()` is 1, `expect(geo.options()).toEqual([{ enableHighAccuracy: false, maximumAge: 10_000 }])`.
This is a pin: it passes on the current code. Prove it bites before committing: temporarily change `enableHighAccuracy` to `true` in `location.ts`'s `useOnlineReport`, see the test fail, revert (do not commit `location.ts`), and paste both runs in your log. No `feat:`/`fix:` for this section.

### Commit 1, `test: accept an offer`
Add to `src/offer.test.tsx` (online rider, the offer answers `json(200, offer())`; route `POST /api/rider/v1/me/offers/${offer().id}/accept` per test, counted):
- `accepted`: accept answers `json(201, delivery({ id: 'd1' }))`, and `GET /api/rider/v1/me/deliveries/d1` answers `json(200, delivery({ id: 'd1' }))`; press "Accept" in "New order SS-AAAA0001"; the level-1 heading "Order SS-AAAA0001" shows, the router's location is `/deliveries/d1` (`renderApp` returns the router), one accept call.
- `someone else took it`: accept answers `apiError(409, 'conflict')`; press "Accept"; the dialog closes; a `status` with "Someone else took SS-AAAA0001."; advance 6 s: no dialog.
- `accept fails`: accept answers `apiError(502, 'internal')`; press "Accept"; the dialog stays open and holds an `alert` with "Could not accept the order. Try again.".
Red: the three fail ("Accept" does nothing). Commit with your log.

### Commit 2, `feat: accept an offer and open its delivery`
In `OfferSheet` (`src/dispatch.tsx`), a `useMutation` like `ReadyPage`'s claim (`src/ready.tsx`):
- `mutationFn(o: Offer)`: `rider.POST('/me/offers/{id}/accept', { params: { path: { id: o.id } } })`, throw `error.error` on error, return the `Delivery`.
- `onSuccess(delivery, o)`: `setAnswered(o.id)`, `setStatus(undefined)`, `queryClient.setQueryData(deliveryQuery(delivery.id).queryKey, delivery)`, invalidate `['rider', 'ready']` and `['rider', 'deliveries', 'assigned']`, then `navigate({ to: '/deliveries/$deliveryId', params: { deliveryId: delivery.id } })`.
- `onError(error, o)`: code `conflict` or `not_found` → `setAnswered(o.id)`, `setStatus(`Someone else took ${o.number}.`)`; anything else keeps the sheet and shows `<ErrorBanner message="Could not accept the order. Try again." />` inside it (from `accept.isError`). Reset the mutation when a new offer opens (as `ReadyPage.pick` does with `claim.reset()`), so an old error does not show on the next offer.
- "Accept": `loading={accept.isPending}`, `onClick={() => accept.mutate(offer)}`.
- While the accept is pending, `decline` and the sheet's `onClose` do nothing, and the countdown reaching 0 does not close the sheet (the answer decides).
- Gates (paste tails): `npm run lint --workspace apps/rider`, `npm run typecheck --workspace apps/rider`, `npm run test --workspace apps/rider -- --run`, `npm run build --workspace apps/rider`, `openspec validate --all --strict`, then `make test-web` from the worktree root (every workspace green). Tick 5.1 and 5.2. Commit.

## Log
Status: in progress (worker)

- Section 0 (commit `ad1c142`, `test: online position watch uses low accuracy and a 10 s maximum age`): `fake-geolocation.ts` records `options` per watch and exposes `options()`; pin `online watch options` in `availability.test.tsx`.
  - Passes on current code (12/12 in `availability.test.tsx`).
  - Bite proof: `location.ts` line 64 `enableHighAccuracy: false` swapped to `true`, run: `FAIL src/availability.test.tsx > online watch options` / `AssertionError: expected [ { enableHighAccuracy: true, …(1) } ] to deeply equal [ { enableHighAccuracy: false, …(1) } ]`; 1 failed, 11 passed. Reverted; `location.ts` not in any commit.
- Commit 1 (`test: accept an offer`): `accepted`, `someone else took it`, `accept fails` added to `offer.test.tsx`. Red run (`npm run test --workspace apps/rider -- --run src/offer.test.tsx`):
  - `× accepted`: `TestingLibraryElementError: Unable to find role="heading" and name "Order SS-AAAA0001"`
  - `× someone else took it`: `TestingLibraryElementError: Unable to find role="status"`
  - `× accept fails`: `TestingLibraryElementError: Unable to find role="alert"`
  - `Tests 3 failed | 5 passed (8)`; the five existing offer tests stay green.
- Commit 2 (`feat: accept an offer and open its delivery`): `OfferSheet` in `dispatch.tsx` gets a `useMutation` (POST accept, `onSuccess` sets the answer, seeds the delivery query, invalidates ready and assigned, navigates to `/deliveries/$deliveryId`; `onError` for `conflict` or `not_found` closes with "Someone else took <number>.", other failures keep the sheet with `ErrorBanner`). Accept shows `loading` while pending; decline, the sheet's close and the countdown's expiry do nothing while pending. The mutation resets when the offer id changes, so an old error does not show on the next offer.
- Gates (worktree root):
  - `npm run lint --workspace apps/rider`: no output, eslint clean.
  - `npm run typecheck --workspace apps/rider`: no output, tsc clean.
  - `npm run test --workspace apps/rider -- --run`: `Test Files 12 passed (12)`, `Tests 84 passed (84)`; the three accept tests green.
  - `npm run build --workspace apps/rider`: `✓ built`.
  - `openspec validate --all --strict`: `Totals: 21 passed, 0 failed (21 items)`.
  - `make test-web`: exit 0. Per workspace: `packages/ui` 35 files / 104 tests; `apps/admin` 28 / 343; `apps/rider` 12 / 84; `apps/web` 29 / 183; `apps/mobile` (jest) 98 suites / 383 tests. Every build and lint step green.
- Ticked 5.0, 5.1 and 5.2 in `openspec/changes/rider-app-dispatch/tasks.md`.
