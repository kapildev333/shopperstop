# rider-P5-L3-T2 - availability in the banner (task 2 of rider-app-dispatch)
Status: brief

## Brief
- LANE-ID: rider-P5-L3 (task T2). Area: rider. Model: worker. Starts after T1 is committed.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/rider-P5-L3`, branch `lane/rider-P5-L3-app-dispatch`. Commit as `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no trailers. Never push. Never run `make e2e`, `make db`, `make dev` or `docker`.
- Scope (edit only these): `apps/rider/src/dispatch.tsx` (new), `apps/rider/src/api.ts`, `apps/rider/src/routes/__root.tsx`, `apps/rider/src/fake-api.ts`, `apps/rider/src/availability.test.tsx` (new), `openspec/changes/rider-app-dispatch/tasks.md` (tick 2.1, 2.2), this file (log).
- Change and task: `openspec/changes/rider-app-dispatch/`, task 2. Scenarios: `specs/rider-app/spec.md` "Availability in the banner": Offline rider, Go online then offline, Change fails. Read design.md Decisions 1, 2, 10, 11 (no `aria-pressed`: manager's decision).
- Setup: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; `test -d node_modules || npm ci`.

### Commit 1, `test: availability in the banner`
1. `src/fake-api.ts`: add `isOnline: false` to `arjun` (rider-P5-L2's request); add the `Offer` type import (`components['schemas']['Offer']`) and a fixture used from task 4 on:
   ```ts
   export function offer(over: Partial<Offer> = {}): Offer {
     const now = Date.now()
     return {
       id: '00000000-0000-4000-8000-000000000b01', orderId: '00000000-0000-4000-8000-000000000a01', number: 'SS-AAAA0001',
       placedAt: new Date(now - 5 * 60_000).toISOString(), itemCount: 3, totalCents: 33900, paymentMethod: 'cod', pincode: '560034',
       etaSeconds: 90, offeredAt: new Date(now).toISOString(), expiresAt: new Date(now + 30_000).toISOString(), ...over,
     }
   }
   ```
2. `src/availability.test.tsx` (new). Follow `location.test.tsx` and `ready.test.tsx` for setup. From the start, `beforeEach` sets the token, `vi.useFakeTimers({ shouldAdvanceTime: true })` and installs `fakeGeolocation()`; `afterEach` removes it, clears the token, restores timers and globals (task 3 makes an online rider without a Geolocation API go offline, so every test here needs the fake). A `routes(over)` helper gives `signedInRoutes()`, `GET /api/rider/v1/me/ready-orders` → `{items: []}`, `GET /api/rider/v1/me/deliveries` → `{items: [], page: 1, pageSize: 24, total: 0}`, `PUT /api/rider/v1/me/availability` → echoes `{...arjun, isOnline: body.online}` and records each body, `PUT /api/rider/v1/me/location` → 204.
   - `offline rider`: open `/`; in `screen.getByRole('banner')` the text "Offline" and a button "Go online" with no `aria-pressed` attribute (`not.toHaveAttribute('aria-pressed')`; design Decision 11).
   - `go online, then offline`: press "Go online" (userEvent with `advanceTimers: vi.advanceTimersByTime`); banner shows "Online" and the button "Go offline" (no `aria-pressed`); press it; banner shows "Offline" and "Go online"; recorded bodies are `[{online: true}, {online: false}]`.
   - `change fails`: availability answers `apiError(502, 'internal')`; press "Go online"; banner still "Offline"; `screen.getByRole('status')` has text "Could not change your status. Try again.".
   Red: the three fail (no badge, no button). Commit with the fixtures and your log.

### Commit 2, `feat: go online and offline from the banner`
- `src/api.ts`: `export type Offer = components['schemas']['Offer']`.
- `src/dispatch.tsx` (new), `export function Availability()`:
  - `const me = useQuery(meQuery).data` (design Decision 2: the route context's rider never updates; `meQuery` is already cached, no extra request). `online = me?.isOnline === true` (a missing `isOnline` is offline).
  - `useMutation` on `rider.PUT('/me/availability', { body: { online } })` (throw `error.error` on error); `onSuccess`: `queryClient.setQueryData(meQuery.queryKey, answered)`; `onError`: set the message "Could not change your status. Try again.".
  - The button's `onClick` clears the message, then `mutate(!online)` (clear it here, not in `onMutate`: task 3 sets a message right before a mutate).
  - Renders `<Badge variant={online ? 'success' : 'neutral'}>{online ? 'Online' : 'Offline'}</Badge>`, `<Button variant="secondary" loading={pending} onClick=...>{online ? 'Go offline' : 'Go online'}</Button>`, and when set `<StatusMessage tone="warning" className="basis-full">{message}</StatusMessage>`.
- `src/routes/__root.tsx`: inside the existing `me &&` row, render `<Availability />` after the rider's name and before "Sign out". Nothing else in the shell changes.
- Gates (paste tails): `npm run lint --workspace apps/rider`, `npm run typecheck --workspace apps/rider`, `npm run test --workspace apps/rider -- --run` (all files green, the old shell tests included), `npm run build --workspace apps/rider`, `openspec validate --all --strict`. Tick 2.1 and 2.2. Commit.

Stop and report under Blockers if `Badge`, `Button` or `StatusMessage` cannot do the above without a change in `packages/ui` (not your scope), or if an existing test breaks for a reason other than the banner's new content.

## Log
