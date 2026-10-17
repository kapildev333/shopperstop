# rider-P5-L3-T5 - accept an offer (task 5 of rider-app-dispatch)
Status: brief

## Brief
- LANE-ID: rider-P5-L3 (task T5). Area: rider. Model: worker. Starts after T4 is committed.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/rider-P5-L3`, branch `lane/rider-P5-L3-app-dispatch`. Commit as `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no trailers. Never push. Never run `make e2e`, `make db`, `make dev` or `docker`.
- Scope (edit only these): `apps/rider/src/dispatch.tsx`, `apps/rider/src/offer.test.tsx`, `openspec/changes/rider-app-dispatch/tasks.md` (tick 5.1, 5.2), this file (log).
- Change and task: `openspec/changes/rider-app-dispatch/`, task 5. Scenarios: "Accept an offer" (Accepted, Someone else took it, Accept fails). Read design.md Decision 9.
- Setup: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; `test -d node_modules || npm ci`.

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
