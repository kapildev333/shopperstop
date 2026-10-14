# web-P2-L4-T4 - live order tracking: poll, countdown, cancel, phone layout (task 4 of web-checkout-orders)
Status: done (e2e written and typechecked, not run: the manager runs it in its slot)
## Doing
2026-10-13: task 4 landed on `lane/web-P2-L4-checkout-orders`: red `54bf8cd` (test: order poll, countdown and cancel), feat `d527030` (feat: live order tracking with countdown and cancel; tasks 4.1 and 4.2 ticked), this log as chore. Gates green (below). The Playwright e2e is not run (the manager's slot; the ports are in use by the manager's copy).
## Found
- Red run (`54bf8cd`, Vitest on the two files): 7 failed, 7 passed. "poll interval follows the status": `pollInterval is not a function`. "countdown counts down" and "countdown after the promise": `Countdown` is not exported (element type undefined). "no countdown once finished": fails at its control, a placed order with its store known shows "Arriving in 7 minutes"; its absence checks alone would pass, so the control is what makes them mean something. "cancel offered while placed or accepted", "order cancelled", "cancel refused": no "Cancel order" button. Still green: the seven existing tracking, status and poll-failure tests, "failed poll keeps the order" among them.
- Typecheck at the red commit: four errors (the two missing exports, the `send` prop of `OrderPage`); the e2e files typecheck clean.
- Green (`d527030`): `orders.ts` gains `pollInterval`, `arrival`, `postCancel`, `cancelOrder`, and `refetchInterval` in `orderOptions`; `order-parts.tsx` gains `Countdown`; `order-tracking.tsx` gains the countdown beside the status, "Cancel order" while `canCancel`, and the dialog outside that condition.
- Deviations from design.md, none in behaviour:
  - `OrderPage` calls `useStore(order?.storeId)` before its early returns (hook order). `OrderContent` takes `id`, `store` (the data) and `send`.
  - `cancelOrder` reads the token with `getToken() ?? ''` (it is a module function, like `placeOrder`'s guard, not a hook).
  - "no countdown once finished" runs on the real clock: a placed order three minutes old, so its control shows "Arriving in 7 minutes" without faking anything; the fake clock is only in the two counting tests.
- Not proven by any test here: after a 409 the design says the order is read again and the confirm button goes (only "Keep order" is left). The re-read fails under jsdom (no HTTP), so the seeded placed order stays and the confirm stays; no e2e cancels a 409 either. The behaviour is by reading of the code.
- Phone layout (`e2e/orders.spec.ts`, "checkout and orders on a phone"), predicted, not observed: red at the "Cancel order" control, the first missing element; the other controls are predicted green (md buttons are `h-11` below the `sm` breakpoint, `Chip` `h-11`, `Price` carries `tabular-nums`, no fixed widths). No layout class was changed; if the manager's run shows an overflow, the fix is a class in the files section 4 lists.
- Predicted e2e (not run): "tracking follows the order against core" red until the poll exists (now it does); "cancel against core" red until the cancel exists (now it does); "unknown order against core" green on arrival, as the brief says.
- Lane logs read at start and before finish: no request addressed to this task in `.claude/lanes/`.
- Review follow-up (`fb0f0c6`, test: a refused cancel reads the order again): a pin, green on arrival. Mutation (the dialog's confirm button un-gated from `canCancel`) turned it red at the "no confirm button" assertion, then reverted. Lint and typecheck exit 0; the tracking test file 13 of 13 in five runs.
## Requests
- to web-P2-L4 (manager): run the four tests of `e2e/orders.spec.ts` added here, in one slot, with the Makefile's `E2E_ENV` (`CI=1 npm run e2e --workspace apps/web`): "tracking follows the order against core", "cancel against core", "checkout and orders on a phone", "unknown order against core". The 390 px assertions are the ones to read if the phone test is red; the classes are not changed. Task 4.2's e2e half stays open until the run, as task 3.2's did.
## Blockers
None.
