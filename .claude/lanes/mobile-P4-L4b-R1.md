# mobile-P4-L4b-R1 - review of mobile-P4-L4b tasks 0-5, F1, F2 (branch lane/mobile-P4-L4b-checkout)
Status: done
## Doing
Verdict: approve, no blocking findings.
## Found
Non-blocking:
1. `src/checkout.ts` `placeOrder(addressId, send = postOrder)`: `send` is never passed (callers: checkout-screen.tsx:63, checkout.test.ts:77-114). Dead flexibility; drop the parameter.
2. `src/checkout-place.test.tsx` `Place order sent once` and `...sends nothing while the address list is unread`: after 803c450 the presses are awaited, so the same-tick guarantee of the `sending` ref (checkout-screen.tsx:57) is no longer exercised (a state-only guard would also pass). Assertions were not weakened (diff is `await` only). The "sends nothing" test checks the POST count right after one microtask, so it can pass before a wrongly sent POST would fire; add a `waitFor`/flush before the count.
3. `src/checkout-address.tsx` Change button has `accessibilityLabel="Change address"`; spec and scenarios say a "Change" button. Better a11y, but spec text and the e2e must say so (Playwright name match is substring, so "Change" still finds it). Update the spec delta wording.
4. e886eee is labelled `fix:` but changes only a test (account.test.tsx); should be `test:`. F2 itself is right (findByText for the profile).
5. Place order button is shown (enabled, a tap does nothing) while the address list is unread (checkout-screen.tsx hasAddress). Matches the lane's choice; a busy/disabled state or skeleton would be kinder.
T3 loading test: the rewrite keeps every assertion (Loading, offline alert, Try again, lines). The old two-render version cleared the shared module-level queryClient mid-test; no sign of an app cleanup bug (all later tests render fine, three jest runs green). T4 803c450: only `await` added, no assertion changed.
Checked and fine: placing inside `queued`, session recheck, one retry on conflict, cart set to empty plus order seeded, orders list invalidated (no staleTime), address validation refetch, unconfirmed copy plus "Your orders", replace to /orders/<id>, marks only on `productIds`, Remove via useLineWrite(0), block precedence, fees/minimum from useCart().view, store via storeOptions(view.storeId), redirect, F1 (`throw error.error`, tested), tokens only, 44px targets, alert roles, muted text only on surface/canvas pads.
## Gates (worktree, committed state)
eslint, tsc: clean. npm test: node tests 7/7; jest 90 suites, 355 tests; two more `npx jest --ci` runs identical, green. `openspec validate --all --strict`: 20 passed, 0 failed.
## Requests
none
## Blockers
none
