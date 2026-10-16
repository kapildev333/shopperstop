# mobile-P4-L4a-T1 - order logic (src/orders.ts)
Status: done
## Doing
Task 1 landed: test commit f4e7c12 (red: module missing), feat commit f1a6784 (green, gates pass). Tasks 1.1 and 1.2 ticked.
## Found
- `src/orders.ts` exports the design §5 interface minus placement, the cart, `arrival` and `formatWhen` (not in this task). `Step`, `timeline`, `headline`, `clockTime`, `placedLabel`, `itemCountLabel`, `productCountLabel`, `useNow`, `postCancel(id, reason?)` (body `{ reason }` or `{}`), `cancelOrder(id, reason?)` are in it.
- `rider.ts` is not imported (T2 runs in parallel).
- `npm run test --workspace apps/mobile -- --run <file>` runs the whole suite (the script's `sh -c 'jest --ci' --` drops the path argument). Use `npx jest --ci <file>` in `apps/mobile` for one file.
- Full suite once: `account.test.tsx` failed under parallel load and passed alone; the rerun was green (27 suites, 111 tests).
## Requests
None.
## Blockers
None.
