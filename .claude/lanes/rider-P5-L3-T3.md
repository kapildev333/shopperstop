# rider-P5-L3-T3 - position while online; location needed to stay online (task 3 of rider-app-dispatch)
Status: brief

## Brief
- LANE-ID: rider-P5-L3 (task T3). Area: rider. Model: worker. Starts after T2 is committed.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/rider-P5-L3`, branch `lane/rider-P5-L3-app-dispatch`. Commit as `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no trailers. Never push. Never run `make e2e`, `make db`, `make dev` or `docker`.
- Scope (edit only these): `apps/rider/src/location.ts`, `apps/rider/src/dispatch.tsx`, `apps/rider/src/availability.test.tsx`, `openspec/changes/rider-app-dispatch/tasks.md` (tick 3.1, 3.2), this file (log).
- Change and task: `openspec/changes/rider-app-dispatch/`, task 3. Scenarios: "Position reported while online" (First fix then every 10 seconds, Online on load, Offline stops the watch) and "Location needed to stay online" (Permission refused, No Geolocation API). Read design.md Decisions 3 and 4.
- Setup: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; `test -d node_modules || npm ci`.

### Commit 1, `test: position reported while online; location needed to stay online`
Add to `src/availability.test.tsx` (reuse its `routes` helper; record the bodies of `PUT /api/rider/v1/me/location` in a `sent` array; "online" riders come from `GET /api/rider/v1/me` answering `{...arjun, isOnline: true}`):
- `first fix, then every 10 seconds`: offline rider on `/`, press "Go online", `await waitFor(() => expect(geo.watching()).toBe(1))`, `act(() => geo.fix(12.9719, 77.6412))`; `sent` is one `{lat: 12.9719, lng: 77.6412}`; `await act(() => vi.advanceTimersByTimeAsync(10_000))`; `sent` has two.
- `online on load`: online rider opens `/history` (route `GET /api/rider/v1/me/deliveries` from `routes`); `geo.watching()` becomes 1 with no user action.
- `offline stops the watch`: online rider on `/`, a fix is sent; press "Go offline"; `geo.watching()` becomes 0; advancing 20 s sends nothing more.
- `sign-out stops the watch`: online rider on `/`, a fix is sent; press "Sign out"; the sign-in page heading shows; `geo.watching()` is 0; advancing 20 s sends nothing more.
- `permission refused`: press "Go online", watch starts, `act(() => geo.fail(1))`; availability bodies end with `{online: false}`, banner shows "Offline", `getByRole('status')` has "Allow location to go online".
- `no geolocation api`: `geo.remove()` before render; online rider opens `/`; availability receives `{online: false}`, "Allow location to go online" shows.
Red: these six fail (no watch while online). Commit with your log.

### Commit 2, `feat: report the position while online, go offline when location is refused`
- `src/location.ts`: pull the body of `useLocationReport`'s effect into a non-exported `watchAndSend(everyMs: number, options: PositionOptions, onError: (error: GeolocationPositionError) => void): () => void` (watch, send the first fix at once, then the latest every `everyMs`; returns the cleanup that clears the watch and the interval). `useLocationReport` keeps its behaviour exactly (15 s, `{ enableHighAccuracy: true, maximumAge: 10_000 }`, `setFailed(true)` on any error); `src/location.test.tsx` must pass unchanged.
- Add `export function useOnlineReport(online: boolean, onDenied: () => void)`:
  - `const deny = useEffectEvent(onDenied)` (React 19.2+; if the linter or types refuse it, keep the latest callback in a ref updated in an effect and say so in your log).
  - effect on `[online]`: not online → nothing; no `'geolocation' in navigator` → `deny()` and return; else `return watchAndSend(10_000, { enableHighAccuracy: false, maximumAge: 10_000 }, (error) => { if (error.code === 1) deny() })` (compare with `1`, not `error.PERMISSION_DENIED`: the test fake has no constants; other errors change nothing, design Decision 3).
  - A `// ponytail:` comment: positions on a 10 s interval, not per change (a still rider would go stale on Chromium's per-change callbacks); no background location in a web app.
- `src/dispatch.tsx` `Availability`: call `useOnlineReport(online, () => { setMessage('Allow location to go online'); change.mutate(false) })`. The hook must be called before any early return.
- Gates (paste tails): `npm run lint --workspace apps/rider`, `npm run typecheck --workspace apps/rider`, `npm run test --workspace apps/rider -- --run`, `npm run build --workspace apps/rider`, `openspec validate --all --strict`. Tick 3.1 and 3.2. Commit.

Stop and report under Blockers if `location.test.tsx` needs any change to pass.

## Log
- Commit 1 `test: position reported while online; location needed to stay online` (red). `routes` now also returns `sent` (location bodies). Red: `npm run test --workspace apps/rider -- --run src/availability.test.tsx` → 6 failed | 3 passed. Failing: `first fix, then every 10 seconds`, `online on load`, `offline stops the watch`, `sign-out stops the watch`, `permission refused`, `no geolocation api`. Reason: `expected +0 to be 1` (no watch while online) on the five watch tests; `expected [] to deeply equal [ { online: false } ]` on `no geolocation api`.
