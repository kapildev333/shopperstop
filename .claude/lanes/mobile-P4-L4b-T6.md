# mobile-P4-L4b-T6 - checkout e2e against core (`e2e/checkout.spec.ts`, task 6 of mobile-checkout)
Status: done
## Doing
Test commit 33da754 (four scenarios, red-run: 3 passed, 1 failed on the tracking line's text). Fix commit c864556 (the tracking screen draws each line as "<qty> × <name>"). Scenario run green: 4 passed. Full `make e2e` from the worktree root: exit 0. Task 6 ticked.
## Found
- Red run (`npm run e2e --workspace apps/mobile -- e2e/checkout.spec.ts`): "Address added at checkout", "Out of stock at checkout" and "Address not served" passed on the first run; "Order placed" failed on `getByText('Sparkle Home Dishwash Gel', exact)` on the tracking screen. The app draws each order line as one text, `<qty> × <name>` (`src/orders-tracking.tsx`); the test expectation was wrong, not the screen. Fixed in c864556.
- Picks: `orderPick` indices 2 (address added), 3 (order placed, guest through search), 4 (out of stock), 5 (address not served).
- Helpers copied from `e2e/orders.spec.ts` and `e2e/cart.spec.ts`; `orderPick` returns the product name, `addAddress` takes a label and pincode. Axe runs on checkout, the address sheet open and closed, tracking, the alert states; not on the search screen (the guest adds through it, as L2's search is not in this suite's scope).
- Env for the iterations: `make -f Makefile -f - show` prints `E2E_ENV` from the worktree's Makefile (`$(CURDIR)` is the worktree); sourced into the shell before `npm run e2e`.
## Gates
- `make e2e` from the worktree root (after c864556): exit 0. Per workspace: admin 15 passed; mobile 25 passed (4 of them the checkout scenarios: Address added at checkout, Order placed, Out of stock, Address not served against core); rider 7 passed; web 45 passed. Ports 18080, 18081, 15173-15176 free afterwards.
- `npm run lint --workspace apps/mobile`: exit 0. `npm run typecheck --workspace apps/mobile`: exit 0. `npm run test --workspace apps/mobile -- --run`: exit 0, 90 suites, 355 tests passed. `npm run build --workspace apps/mobile`: exit 0. `openspec validate --all --strict`: 20 passed, 0 failed.
## Requests
none
## Blockers
none
