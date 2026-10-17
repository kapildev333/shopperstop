# rider-P5-L3-T7 - accept while pending, decline disabled, simpler error banner (task 7 of rider-app-dispatch)
Status: brief

## Brief
- LANE-ID: rider-P5-L3 (task T7). Area: rider. Model: worker. Starts after T6's `fix:` is committed (T6 edits the same files). Written against T5's `50e4913` plus T6's brief (`OfferSheet` mounts a non-exported `OnlineOffer` while online). If T6's head differs so the steps below do not fit, stop and report.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/rider-P5-L3`, branch `lane/rider-P5-L3-app-dispatch`. Commit as `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no trailers. Never push. Never run `make e2e`, `make db`, `make dev` or `docker`.
- Scope (edit only these): `apps/rider/src/dispatch.tsx`, `apps/rider/src/offer.test.tsx`, `apps/rider/src/ready.tsx` (export two keys only), `openspec/changes/rider-app-dispatch/tasks.md` (tick 7.1 to 7.3), this file (log).
- Change and task: `openspec/changes/rider-app-dispatch/`, task 7, from review R5 (`.claude/lanes/rider-P5-L3-R5.md`). Scenarios: "Decline an offer" ("They SHALL do nothing while an accept is pending"), "Offer sheet" ("with no accept pending"), "Accept an offer" (404, the 201 path). Read design.md Decision 9 (updated for this task).
- Setup: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; `test -d node_modules || npm ci`.

### Commit 1, `test: nothing answers while an accept is pending; 404 taken; caches invalidated; no old accept error on a new offer`
In `src/offer.test.tsx` (`userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`, online rider, the offer read answers `offer()` unless stated):
1. `nothing answers while an accept is pending`: the accept route returns `new Promise<Response>(() => {})`; count decline calls. Press "Accept". Then: the dialog's "Decline" button is disabled (`toBeDisabled()`); press it anyway (`user.click` on a disabled button is a no-op, which is the point); `await user.keyboard('{Escape}')`; `await act(() => vi.advanceTimersByTimeAsync(30_000))`. The dialog "New order SS-AAAA0001" is still open, decline calls are 0, and `screen.queryByText('Offer expired')` is null. Red today only on `toBeDisabled()`. Before committing, prove the guards matter: temporarily delete the `if (accept.isPending) return` in `decline`, see the test fail on Escape; restore; delete the one in `expire`, see it fail at 30 s; restore. Paste the three runs in your log.
2. `someone else took it (404)`: like `someone else took it` with `apiError(404, 'not_found')`: the dialog closes and the status "Someone else took SS-AAAA0001." shows.
3. `accept invalidates the ready and assigned lists`: like `accepted`; keep the router from `renderApp`; after "Order SS-AAAA0001" shows, `const qc = router.options.context.queryClient`; `expect(qc.getQueryState(['rider', 'ready'])?.isInvalidated).toBe(true)` and the same for `['rider', 'deliveries', 'assigned']`. (Both queries exist: the Pick up page read them before the accept.)
4. `a new offer shows no old accept error`: o1 then o2 (`offer({ id: '...0b02', number: 'SS-AAAA0002' })` once o1's decline is called, as in `decline closes the sheet`); o1's accept answers `apiError(502, 'internal')`. Press "Accept": the alert "Could not accept the order. Try again." shows. Press "Decline". Advance 3 s: dialog "New order SS-AAAA0002" opens with no `alert` inside it. This pins today's `resetAccept` behaviour for the refactor in commit 3.
Red: test 1 (the disabled assertion). Tests 2 to 4 are pins; say so in the log. Commit.

### Commit 2, `fix: decline is disabled while an accept is pending`
`OfferBody`'s "Decline" button gets `disabled={accepting}`. Keep the `isPending` guards in `decline` and `expire` (Escape, the Close icon and the countdown still reach them). Gates. Commit.

### Commit 3, `refactor: one error banner per offer; list keys from ready.tsx`
- Delete `const resetAccept = accept.reset` and its `useEffect`. Render the banner as `{accept.isError && accept.variables?.id === offer?.id && <ErrorBanner ... />}`. If T6 put the "new offer clears the status" step inside that effect, keep that step (move it to the render-time `seenId` pattern T6's brief describes) and delete only the reset. Drop `useEffect` from the imports only if nothing else uses it.
- `src/ready.tsx`: `export const readyKey` and `export const assignedKey` (no other change). `src/dispatch.tsx` imports them and uses them in the two `invalidateQueries` calls instead of the literal arrays.
- Gates (paste tails): `npm run lint --workspace apps/rider`, `npm run typecheck --workspace apps/rider`, `npm run test --workspace apps/rider -- --run` (every file green; tests 1 to 4 above unchanged), `npm run build --workspace apps/rider`, `make test-web`, `openspec validate --all --strict`. Tick 7.1 to 7.3. Commit.

## Log
Status: doing (commit 1 of 3 ready)

### Commit 1 (test) log
- Start check: T6 head d021746 fits the brief (`OnlineOffer`, render-time `seenId` reset, `resetAccept` effect present).
- Deviation 1 (pin 3, `accept invalidates the ready and assigned lists`): the brief's `isInvalidated` check is false after accept. The Pick up page is still mounted when `invalidateQueries` runs, so the ready list refetches and clears the flag; the assigned query has no observer at that point. The test spies `qc.invalidateQueries` and asserts the two keys instead. Same intent (the calls happen), exact keys, survives commit 3.
- Deviation 2 (test 1): the brief's `offer()` per poll never expires: each poll moves `expiresAt` forward 30 s, so the countdown never reaches 0. Test 1 uses one fixed `const same = offer()`, as `offer expires` does.
- Bite proof (brief asks for Escape and 30 s failures; test 1 cannot reach them while Decline is enabled): for each run the `disabled={accepting}` line was applied temporarily, then one guard removed. Restored after each run.
  - Decline guard removed (`function decline` first line deleted): FAIL `TestingLibraryElementError: Unable to find an accessible element with the role "dialog" and name "New order SS-AAAA0001"` at `offer.test.tsx:325`. Escape closed the sheet.
  - Expire guard removed: same failure at `offer.test.tsx:325`. The 30 s countdown closed the sheet.
  - Restored: `dispatch.tsx` byte-equal to d021746.
- Red on the committed tree (baseline, no fix): `expect(element).toBeDisabled()` `offer.test.tsx:320`, Received element is not disabled. 17 of 18 green (tests 2 to 4 pass).

### Commit 2 (fix) log
- Decline `disabled={accepting}`; the `isPending` guards in `decline` and `expire` kept. offer.test.tsx 18/18 green. lint and typecheck clean.
