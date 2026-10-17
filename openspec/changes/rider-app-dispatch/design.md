## Context
The rider service on main serves availability, offers and the dispatcher (rider-P5-L2, `openspec/specs/dispatch/`, `services/rider/openapi.json`). The app (`apps/rider`) is a TanStack Router + Query app: the `/_rider` guard loads `GET /me` into `meQuery` (staleTime Infinity) and passes it to the shell as route context; the shell (`src/routes/__root.tsx`) renders the banner; `src/location.ts` holds the delivery page's position report; tests render the real router with `renderApp`, fake the services with `fakeApi` and the device with `fakeGeolocation`.

## Goals / Non-Goals
Goals: the rider can go online and offline, the app keeps the dispatcher's position fresh while online, an offer can be accepted or declined in time, and the Phase 3 flow is unchanged for offline riders.
Non-goals: push or SSE, background location, offer sounds, offers while on a delivery, any service change.

## Decisions

### 1. Files
- `src/dispatch.tsx` (new): `Availability` (banner badge, toggle, its status line, and the position hook) and `OfferSheet` (poll, sheet, countdown, accept, decline, its status lines).
- `src/location.ts`: a shared non-hook `watchAndSend(everyMs, options, onError)` used by the existing `useLocationReport` (15 s, high accuracy on, unchanged behaviour) and a new `useOnlineReport(online, onDenied)` (10 s, high accuracy off, maximum age 10 s).
- `src/api.ts`: `export type Offer = components['schemas']['Offer']`.
- `src/routes/__root.tsx`: renders `<Availability />` in the banner row after the rider's name and before "Sign out", and `<OfferSheet />` at the top of `<main>`, both only while `me` is set.
- `src/fake-api.ts`: `arjun` gains `isOnline: false`; new `offer(over)` fixture.
- `services/rider/openapi.json`: `isOnline` in `Rider.required`; regenerated `packages/ui/src/api/rider.d.ts` and the rider Postman collection (Decision 13).
- Tests: `src/availability.test.tsx`, `src/offer.test.tsx` (new). e2e: `e2e/helpers.ts`, `e2e/online.spec.ts` (new).

### 2. The online state lives in `meQuery`
The route context's `rider` is a snapshot taken by the guard and never updates. `Availability` and `OfferSheet` read `useQuery(meQuery)` (already cached, so no extra request), and the toggle writes the answered rider with `queryClient.setQueryData(meQuery.queryKey, rider)`. No local copy of `isOnline`, nothing in `localStorage` (the server is the only truth; a reload reads `GET /me`).

### 3. Go online first, then watch
Pressing "Go online" only sends `PUT /me/availability {online: true}`. One effect, keyed on `isOnline`, then starts the watch; the same effect runs when the app loads with `isOnline` true. A permission error (`code === 1`) or a missing `navigator.geolocation` calls `onDenied`, which sends `{online: false}`, writes the answer into `meQuery` and shows "Allow location to go online". So the toggle, a reload and a refusal share one path. Cost: a refusal sends two availability puts; harmless, and the dispatcher never offers to a rider without a fresh position (location TTL), so the brief online moment without a position offers nothing. Other position errors (unavailable, timeout) change nothing: the location TTL drops a rider whose position goes stale.

### 4. Position every 10 s from the first fix, not per change
Chromium's `watchPosition` calls back only when the position changes; a rider waiting still at the store would go stale after the 2-minute location TTL and stop getting offers. So, like the delivery page, the first fix is sent at once and the latest one every 10 s on an interval. While an online rider is on a delivery page both reports run (10 s and 15 s). ponytail: double reporting on the delivery page; pause the online report there if the request rate ever matters.

### 5. Polling the offer
`useQuery({ queryKey: ['rider', 'offer'], enabled: isOnline, refetchInterval: 3_000, gcTime: 0, retry: false })`; the query function answers `null` for 204 (`response.status === 204`, not `data`, so an openapi-fetch empty body never reads as an offer) and throws on an error, which the component ignores (no message: the next poll retries). `gcTime: 0` drops the cached offer when the sheet unmounts on going offline, so going online again never flashes an old offer.

### 6. One answered id
`OfferSheet` keeps `answered?: string`, the id of the last offer the rider declined, accepted, or let expire. The sheet is open when `offer && offer.id !== answered`. The service keeps answering an offer until it is marked or past its expiry, so this id is what stops the poll reopening it; a new offer has a new id and opens. The status lines ("Offer expired", "Someone else took <number>.") are a `useState` cleared when a new offer opens.

### 7. Countdown on the device clock
Seconds left = `Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000))`, re-rendered by a 1 s interval while the sheet is open; shown as "<n> s left" in a `tabular-nums` span with no live region (the dialog is announced on open; announcing every second would drown the screen reader). At 0, unless an accept is pending, the sheet closes with "Offer expired". ponytail: trusts the phone's clock against the server's `expiresAt`; a skewed clock closes early or late and the service answers 409 on a late accept, which the 409 path handles. If skew is ever seen, count down from the first read instead (`expiresAt - offeredAt` minus the time since the offer was first shown).

### 8. Decline is fire and forget; Close and Escape decline
"Decline", the sheet's "Close" icon and Escape (the `Sheet`'s `onClose`) all set `answered` and send `POST /me/offers/{id}/decline` without waiting; any answer, including a failure, is ignored. A sheet the rider dismissed but did not decline would sit open on the server for up to 30 s while blocking that rider from other offers, so dismissing is declining. ponytail: a failed decline lets the offer run out its 30 s; nothing else is lost. While an accept is pending these do nothing (as the ready list's dialog does).

### 9. Accept
`useMutation` on `POST /me/offers/{id}/accept`: on 201, `setQueryData(deliveryQuery(id).queryKey, delivery)`, invalidate `['rider','deliveries','assigned']` and `['rider','ready']`, set `answered`, navigate to `/deliveries/$deliveryId` (the ready page's claim does the same). 409 or 404: set `answered`, show "Someone else took <number>.". Anything else: `ErrorBanner` "Could not accept the order. Try again." inside the sheet, which stays open with its countdown.

### 10. Copy
From the work package (PLAN.md D57, area plan): "Online", "Offline", "Go online", "Go offline", "Allow location to go online", "New order <number>", "Accept", "Decline", "Someone else took <number>.", "Offer expired". Added by this design: "Could not change your status. Try again.", "Could not accept the order. Try again.", "<n> s left". The sheet body reuses the ready card's lines: `itemCount()` ("3 items"), "Pincode <pincode>", `Price`, `Badge` "Cash".

### 11. A changing label, no `aria-pressed`
The work package asked for a changing label ("Go online" / "Go offline") and `aria-pressed`. Together they read as "Go offline, pressed", which contradicts itself. Area manager's decision (2026-10-16): keep the changing label, drop `aria-pressed`; the label says what pressing does and the "Online"/"Offline" badge says the state. Tests assert the attribute is absent.

### 12. e2e isolation
- `make e2e` runs the workspaces' `e2e` scripts one after another (npm `--workspaces`, alphabetical: admin, mobile, rider, web); inside the rider suite Playwright runs files in parallel workers. The rider suite's global setup resets both databases, so it starts with no ready orders and every rider offline.
- The Phase 3 specs (`deliveries`, `phone-layout`, `flow`) ready orders at Koramangala and claim them by hand with Koramangala riders who never go online, so the dispatcher offers them nothing. `online.spec.ts` uses Indiranagar (`...0402`, seeded at 12.9719, 77.6412): its rider `rider1-indiranagar@shopperstop.local`, its staff `indiranagar@shopperstop.local`, an address in `560038`. The dispatcher works per store, so an online Indiranagar rider is never offered a Koramangala order and no parallel spec can take its offer; no other rider spec readies an Indiranagar order.
- admin-P5-L2's "No rider online" assertion is about Koramangala and runs in the admin suite, before the rider suite. Even so, `online.spec.ts` ends offline twice over: the test presses "Go offline" and asserts it, and a `finally` puts `{online: false}` through the API with the rider's token, so a failed run cannot leave the rider online for a later suite.
- The geolocation is set per test with `context.setGeolocation({ latitude: 12.9719, longitude: 77.6412 })` on top of the config's granted permission (the config's Koramangala position stays for the Phase 3 specs).

### 13. `Rider.isOnline` becomes required
rider-dispatch Decision 10 left it out of `required` only so typed fixtures kept compiling. admin-P5-L2 (#374) put `isOnline: false` on every rider in `apps/admin/src/riders-fake.ts`, and the only other users of the schema are the rider app's `src/api.ts` and `src/fake-api.ts`, which task 2 updates. So task 2 adds `isOnline` to `Rider.required` (and drops the "not listed in required" sentence from its description), regenerates `rider.d.ts` and Postman (`make gen postman`), and the app reads `isOnline` as the plain boolean it now is. Task 2 merges `origin/main` first so admin's fixtures are on the branch for `make test-web`.

## Risks / Trade-offs
- An e2e timing budget: the sheet must open within 10 s of the order reaching ready: one tick (3 s) plus one poll (3 s) plus requests. A slow CI machine near the limit would flake; the timeout is the spec's 10 s and is the first thing to look at.
- Two position reports on the delivery page for an online rider (Decision 4).
- Device clock skew on the countdown (Decision 7).
- The banner row grows by a badge and a button; at 390 px it wraps (the row is `flex-wrap`); the manager's phone walk checks it.

## Ceilings
Each is a `ponytail:` comment where the code makes it: polling every 3 s, no push or SSE (D57); position on an interval, not per change; double reporting on the delivery page; countdown on the device clock; fire-and-forget decline.
