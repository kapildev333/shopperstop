## Why
rider-P5-L2 (`rider-dispatch`, #370) gave the rider service availability, a dispatcher and offers (PLAN.md D57), but no rider can use them: the app has no way to go online, never reports a position outside a delivery, and never reads an offer. This change is the app half of D57: a rider goes online from the banner, the app reports the device position while online, and an offer opens as a sheet the rider accepts or declines. Offline riders keep the Phase 3 ready list and hand claim unchanged.

## What Changes
- Banner: a `Badge` "Online" (`success`) or "Offline" (`neutral`) and a `Button` "Go online" / "Go offline" (no `aria-pressed`: the label and the badge carry the state), which sends `PUT /me/availability {online}`; the state lives only on the server (`Rider.isOnline` from `GET /me`).
- Position while online: `navigator.geolocation.watchPosition` (high accuracy off, maximum age 10 s); the first fix is put at once and the latest one every 10 s. A refused permission, or no Geolocation API, takes the rider back offline with "Allow location to go online". The delivery page keeps its own 15 s report.
- Offers: `GET /me/offer` every 3 s while online (204 is none). An offer opens a `Sheet` "New order <number>" with the item count, pincode, total, the cash badge and a `tabular-nums` countdown to `expiresAt`; "Accept" lands on the delivery page (409 or 404: "Someone else took <number>."), "Decline", Close and Escape decline it, and the countdown at zero closes it with "Offer expired".
- Test fixtures: the app's `Rider` fixture carries `isOnline` (rider-P5-L2's request).
- e2e: `online.spec.ts` at Indiranagar with Playwright geolocation: go online, staff readies an order, the sheet appears within 10 s, accept, deliver, go offline; axe on the sheet. The Phase 3 specs are untouched and their riders stay offline.

## Capabilities
### New Capabilities
None.

### Modified Capabilities
- `rider-app`: ADDED "Availability in the banner", "Location needed to stay online", "Position reported while online", "Offers read while online", "Offer sheet", "Decline an offer", "Accept an offer", "Online dispatch flow end to end". No existing requirement changes: the shell, the ready list, the hand claim and the delivery page keep their wording and tests.

## Impact
- Area: rider. Files: `apps/rider/` only (`src/dispatch.tsx` new, `src/location.ts`, `src/api.ts`, `src/routes/__root.tsx`, `src/fake-api.ts`, tests `src/availability.test.tsx` and `src/offer.test.tsx` new, `e2e/helpers.ts`, `e2e/online.spec.ts` new).
- Contracts relied on: `services/rider/openapi.json` on main (`PUT /me/availability`, `GET /me/offer` 200/204, `POST /me/offers/{id}/accept` 201 `Delivery` / 404 / 409, `POST /me/offers/{id}/decline` 204, `Rider.isOnline`, `Offer`) through the generated `packages/ui/src/api/rider.d.ts`; `@shopperstop/ui` (`Badge`, `Button`, `Sheet`, `StatusMessage`, `ErrorBanner`, `Price`); core's seeded store location (Indiranagar 12.9719, 77.6412, core-P5-L2) for the e2e.
- Not changed: `services/rider/openapi.json`. `Rider.isOnline` stays out of `required` because admin's `Rider` fixtures (`apps/admin/src/riders-fake.ts`) do not carry it yet on main (rider-dispatch design.md Decision 10); a later rider lane marks it required once admin-P5-L2 lands.
- Out of scope: push or SSE (polling only, D57); background location; a sound or vibration on an offer; offers while on a delivery (the service makes none); the admin board's dispatch line (admin-P5-L2).
