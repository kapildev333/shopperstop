# Tasks

Five worker tasks, strictly in order, on branch `lane/rider-P5-L3-app-dispatch` in `.worktrees/rider-P5-L3`; then the manager's e2e and the team lead's acceptance. Each worker's brief is `.claude/lanes/rider-P5-L3-T<n>.md`; the worker writes its log there and ticks this file in its `feat:` commit (task 1 in its only commit).

Setup, from the worktree root: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH` (the default Node breaks Vitest); `test -d node_modules || npm ci`.
Gates for every task, from the worktree root: `npm run lint --workspace apps/rider`, `npm run typecheck --workspace apps/rider`, `npm run test --workspace apps/rider -- --run`, `npm run build --workspace apps/rider`, `openspec validate --all --strict`. Task 5 also runs `make test-web`. Nobody but the area manager runs `make e2e`; no worker touches containers.
Red check: after the `test:` commit's files are written, `npm run test --workspace apps/rider -- --run <file>` fails on the named tests (paste the failing names in the log); typecheck failures on not-yet-written exports count as red.

## 1. e2e: online dispatch flow (written before the pages)

Scope: `apps/rider/e2e/helpers.ts`, `apps/rider/e2e/online.spec.ts` (new); this file.
Scenario: "Online dispatch flow end to end" / Online rider offered a readied order.
Starts from: `e2e/online.spec.ts` `online rider offered a readied order`. It cannot pass until task 5; it is not run by the worker (the manager's `make e2e`). Commit: `test: online rider offered a readied order (e2e)`; no `feat:` (the pages come in tasks 2 to 5). Lint and typecheck must pass; the existing specs' behaviour must not change (helpers keep their Koramangala defaults).

- [x] 1.1 Generalise the helpers to a store (default Koramangala), add `indiranagar`, write `online.spec.ts`; lint and typecheck; commit.

## 2. Availability in the banner

Scope: `apps/rider/src/dispatch.tsx` (new), `apps/rider/src/api.ts`, `apps/rider/src/routes/__root.tsx`, `apps/rider/src/fake-api.ts`, `apps/rider/src/availability.test.tsx` (new), `services/rider/openapi.json`; generated `packages/ui/src/api/rider.d.ts`, `docs/postman/shopperstop-rider.postman_collection.json`; this file. Merge `origin/main` first (admin-P5-L2 #374 fixtures). Extra gates: `make gen postman` (committed, then `git status` clean), `make test-rider`, `make test-web`.
Scenarios: "Availability in the banner" (Offline rider, Go online then offline, Change fails).
Starts from: `src/availability.test.tsx` `offline rider`, `go online, then offline`, `change fails`.
Commits: `test: availability in the banner`, then `feat: go online and offline from the banner`.

- [x] 2.1 `isOnline: false` on the `arjun` fixture, `offer()` fixture and `Offer` type; the three tests; red check; commit.
- [x] 2.2 `Availability` in `dispatch.tsx`, rendered by the shell; `isOnline` in `Rider.required`, `make gen postman`; gates; tick 2.1 and 2.2; commit.

## 3. Position while online; location needed to stay online

Scope: `apps/rider/src/location.ts`, `apps/rider/src/dispatch.tsx`, `apps/rider/src/availability.test.tsx`; this file.
Scenarios: "Position reported while online" (First fix then every 10 seconds, Online on load, Offline stops the watch); "Location needed to stay online" (Permission refused, No Geolocation API).
Starts from: `src/availability.test.tsx` `first fix, then every 10 seconds`, `online on load`, `offline stops the watch`, `sign-out stops the watch`, `permission refused`, `no geolocation api`.
Commits: `test: position reported while online; location needed to stay online`, then `feat: report the position while online, go offline when location is refused`.

- [ ] 3.1 The six tests; red check; commit.
- [ ] 3.2 `watchAndSend` shared by `useLocationReport` and new `useOnlineReport`; `Availability` calls it; the existing `src/location.test.tsx` stays green unchanged; gates; tick 3.1 and 3.2; commit.

## 4. Offers read while online, the offer sheet, decline

Scope: `apps/rider/src/dispatch.tsx`, `apps/rider/src/routes/__root.tsx`, `apps/rider/src/offer.test.tsx` (new); this file.
Scenarios: "Offers read while online" (Offline sends no offer read, Polled every 3 seconds); "Offer sheet" (Offer shown, Offer expires); "Decline an offer" (Decline closes the sheet).
Starts from: `src/offer.test.tsx` `offline sends no offer read`, `polled every 3 seconds`, `offer shown`, `offer expires`, `decline closes the sheet`.
Commits: `test: offers read while online, offer sheet, decline`, then `feat: offer sheet with countdown and decline`.

- [ ] 4.1 The five tests; red check; commit.
- [ ] 4.2 `OfferSheet` in `dispatch.tsx` (an "Accept" button that does nothing yet is allowed; task 5 wires it), rendered by the shell; gates; tick 4.1 and 4.2; commit.

## 5. Accept an offer

Scope: `apps/rider/src/dispatch.tsx`, `apps/rider/src/offer.test.tsx`; this file.
Scenarios: "Accept an offer" (Accepted, Someone else took it, Accept fails).
Starts from: `src/offer.test.tsx` `accepted`, `someone else took it`, `accept fails`.
Commits: `test: accept an offer`, then `feat: accept an offer and open its delivery`.

- [ ] 5.1 The three tests; red check; commit.
- [ ] 5.2 The accept mutation; gates plus `make test-web`; tick 5.1 and 5.2; commit.

## 6. Landing checks (area manager, then team lead)

- [ ] 6.1 Area manager: `make e2e` green with the slot taken (rider suite includes `online.spec.ts`; admin, mobile and web suites unchanged); phone walk at 390 px: banner with the toggle, the offer sheet, the status lines; evidence in the lane's status cell.
- [ ] 6.2 Team lead: `/opsx:verify rider-app-dispatch`: every scenario mapped to a passing test, every task ticked, nothing outside scope.
