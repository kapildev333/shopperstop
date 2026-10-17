# rider-P5-L3-T6 - fix: no stale offer after going online again; status cleared (task 6 of rider-app-dispatch)
Status: in progress (worker)

## Brief
- LANE-ID: rider-P5-L3 (task T6). Area: rider. Model: worker. Starts after T5's `feat:` is committed (T5 edits the same files). Written against `44f0c18`; if T5's feat moved `OfferSheet`'s structure so the steps below do not fit, stop and report.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/rider-P5-L3`, branch `lane/rider-P5-L3-app-dispatch`. Commit as `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no trailers. Never push. Never run `make e2e`, `make db`, `make dev` or `docker`.
- Scope (edit only these): `apps/rider/src/dispatch.tsx`, `apps/rider/src/offer.test.tsx`, `openspec/changes/rider-app-dispatch/tasks.md` (tick 6.1, 6.2), this file (log).
- Change and task: `openspec/changes/rider-app-dispatch/`, task 6, from review R4 (`.claude/lanes/rider-P5-L3-R4.md`). Scenarios: "Offers read while online" (no offer from before going offline), "Offer sheet" (status lines, countdown outside live regions, no answer after expiry), "Decline an offer" (Close icon). Read design.md Decisions 5 and 6 (updated for this task).
- Setup: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; `test -d node_modules || npm ci`.

### The bug
`OfferSheet` stays mounted whenever `me` is set, so when the rider goes offline the disabled offer query keeps its last offer and `gcTime: 0` never applies. If an online rider has an open offer, location is refused (offline), and they press "Go online" again, the old offer opens from the cache before the first new read answers, and "Accept" can be pressed on an expired or taken offer. Second: `status` ("Offer expired", "Someone else took ...") survives going offline, and an older status reappears when a later offer closes without any rider action (say the server stops answering it).

### Commit 1, `test: no stale offer after going online again; status cleared offline and on a new offer; close icon, live region, no decline after expiry`
In `src/offer.test.tsx` add `PUT /api/rider/v1/me/availability` to the routes where needed (echo `{...arjun, isOnline: body.online}`), and use `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`:
1. `going online again shows no old offer`: online rider; the offer read answers `offer()`; the dialog shows. `act(() => geo.fail(1))` (after `geo.watching()` is 1): the banner shows "Offline", no dialog. Switch the offer read to a promise that never resolves (`() => new Promise<Response>(() => {})`). Press "Go online"; the banner shows "Online"; `await act(() => vi.advanceTimersByTimeAsync(100))`; `screen.queryByRole('dialog')` is null. (Red today: the cached offer opens.)
2. `going offline clears the offer status`: online rider, the same `offer()` every read; advance 30 s: "Offer expired" shows. `act(() => geo.fail(1))`: banner "Offline"; `screen.queryByText('Offer expired')` is null. (Red today.)
3. `a new offer clears the old status`: o1 = `offer()` every read; advance 30 s: "Offer expired". Then the read answers o2 (`offer({ id: '...0b02', number: 'SS-AAAA0002' })`): dialog "New order SS-AAAA0002" opens. Then the read answers `json(204)`: advance 3 s: no dialog, and `screen.queryByText('Offer expired')` is null. (Red today: the o1 status comes back.)
4. `close icon declines once`: the dialog shows; press its button "Close"; no dialog; the decline route was called exactly once; advance 6 s: no dialog.
5. `countdown outside any live region`: the dialog shows; `screen.getByText('30 s left').closest('[aria-live], [role="status"], [role="alert"], [role="log"], [role="timer"]')` is null.
6. `no decline after expiry`: the same offer every read; count decline calls; advance 36 s; "Offer expired" shows and decline calls are 0.
Tests 4 to 6 are pins (they should pass already; say so in the log). Red: 1, 2 and 3. Commit with your log.

### Commit 2, `fix: drop the offer when going offline; clear the status on a new offer`
In `src/dispatch.tsx`:
- Split `OfferSheet`: the exported `OfferSheet` reads `online` from `meQuery` and returns `online ? <OnlineOffer /> : null`; the current body (query, `answered`, `status`, accept mutation, `decline`, `expire`, the sheet and the status line) moves into a non-exported `OnlineOffer`, without `enabled` (it only runs while online) and without the `online &&` in `open`. Going offline unmounts it: its state goes, and with no observer `gcTime: 0` drops the cached offer (design Decision 5). Do not add `removeQueries` as well.
- New offer clears the status: when a non-null offer with an id different from the last seen one arrives, set `status` to `undefined`. Use the render-time pattern (`const [seenId, setSeenId] = useState<string>(); if (offer && offer.id !== seenId) { setSeenId(offer.id); setStatus(undefined) }`) or fold it into the existing reset effect guarded by `if (offer)`; never clear on the offer going null (that would wipe "Someone else took ..." on the next 204).
- Keep the `ponytail:` comments; update the comment above the query to say it runs only while mounted, i.e. while online.
- Gates (paste tails): `npm run lint --workspace apps/rider`, `npm run typecheck --workspace apps/rider`, `npm run test --workspace apps/rider -- --run` (every file green, including `availability.test.tsx` and the T5 accept tests), `npm run build --workspace apps/rider`, `make test-web`, `openspec validate --all --strict`. Tick 6.1 and 6.2. Commit.

Stop and report under Blockers if test 1 still shows a dialog after the split (that would mean the cache outlives the unmount, and the fix needs `removeQueries`: a design change for the team lead).

## Log
- Commit 1 (`test: no stale offer after going online again; status cleared offline and on a new offer; close icon, live region, no decline after expiry`): the six tests in `offer.test.tsx`; `routes()` gains a `PUT /me/availability` echo. Each test holds one fixed `offer()` object (a fresh one per read keeps resetting `expiresAt`, so the countdown never ran out).
  - Red (`npm run test --workspace apps/rider -- --run src/offer.test.tsx`):
    - `× going online again shows no old offer`: `AssertionError: expected <div role="dialog" …> to be null` (the cached offer reopens before the new read answers).
    - `× going offline clears the offer status`: `AssertionError: expected <div role="status" …> to be null` (status survives going offline).
    - `× a new offer clears the old status`: `AssertionError: expected <div role="status" …> to be null` (the "Offer expired" line comes back after the 204).
  - Pass on current code (pins): `close icon declines once`, `countdown outside any live region`, `no decline after expiry`.
  - Existing eight offer tests stay green: `Tests 3 failed | 11 passed (14)`.
- Ticked 6.1 in `openspec/changes/rider-app-dispatch/tasks.md`.
