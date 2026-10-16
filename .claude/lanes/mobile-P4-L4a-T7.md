# mobile-P4-L4a-T7 - rider card and cancel on the tracking screen (src/orders-tracking.tsx)
Status: done
## Doing
Task 7 landed. Commits on lane/mobile-P4-L4a-orders: 7390426 test (two scenarios, red: "Unable to find button Cancel order"), a test-only commit scoping the confirm press to the open sheet and dropping an unused import, the feat commit (RiderCard after the timeline card, "Cancel order" after the address card when `canCancel`, `CancelOrderDialog` mounted under the content; tasks 7.1 and 7.2 ticked). Manager additions: A 420740a (history open test asserts the tracking heading), B 2748d2e (cancel double-send guard test; it fails with the ref guard removed), C 2c4a2c3 (rider card flake fix).
## Found
- Flake C, root cause: the card shows the name from `order.riderName` at once; the position ("Last seen ...") and "Open in Maps" come from the rider read a tick later. The test read them synchronously after the heading. A 50 ms delayed read failed it every time; with the wait it passes. Test-side only; no shared file touched. The "cross-test token leak" T5 noted is not the cause: the `act(...)` warnings come from `setToken` notifying hooks still mounted in earlier tests, and they do not change any result.
- With the dialog open, the screen's own "Cancel order" stays in the tree; the test presses the last match (the sheet renders after the screen's button). When `Dialog` from L2 replaces `Sheet` (T6 Requests), revisit this line.
- Empty-state spacing: `RiderCard` returns null with no rider, but its wrapper `View` keeps `marginTop: 12`, so orders with no rider show a 12 px extra gap above the products card. Fixing it needs the margin inside `RiderCard` (T5's file, out of this scope). Left as is; manager to decide.
- Gates at the feat commit: lint exit 0, typecheck exit 0, `npx jest --ci` three runs: 40 suites, 151 tests, all green each time.
## Requests
- to mobile-P4-L4a (manager): decide on the 12 px gap above the products card when no rider is known (see Found).
## Blockers
None.
