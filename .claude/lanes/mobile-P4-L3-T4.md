# mobile-P4-L3-T4 - Write failure under the control (mobile-cart task 4)
Status: done
## Doing
Task 4 done (4.1 and 4.2 ticked). Commits `18307c7` (`test:` red), `1fab8dc` (`test:` harness correction), `791f015` (`feat:` alert and the two integrations).
## Found
- Red run of `src/cart-write-failure.test.tsx` before the alert existed: all four tests fail on "Unable to find an element with role: alert" (no alert role on the card or the product screen).
- Harness correction `1fab8dc`: in `next tap clears the failure` the second press is awaited (not unawaited) and the alert's absence is asserted at once. The unawaited press left an open `act()` that broke the next test ("core's refusal is shown" then "overtaken change shows no failure" timed out at 60 s). The awaited press returns while the write is held, since the handler is synchronous. No assertion changed.
- `overtaken change shows no failure` keeps two unawaited presses on purpose: both taps must land before the first write runs, so the first is skipped by `setQuantity`'s turn check. Two "overlapping act() calls" warnings come from that test only (the stepper's quick-taps test has none because it waits for each count). Passing and stable over repeated runs.
- `src/cart-alert.tsx` (`CartWriteAlert`) now committed in `791f015`; task 5's `src/cart-sheet.tsx` imports it (T5's request answered).
- Integrations: `src/catalog-card.tsx` and `src/app/product/[slug].tsx` use `useLineWrite(storeId, product)` (the hook from task 3, unchanged); the stepper's `onChange` is the hook's write; one `<CartWriteAlert message={failure} />` each (after the price-and-stepper row on the card, inside the bar's price column after "Inclusive of all taxes" on the product screen).
- `src/cart.ts` not touched.
- Gates on `791f015` (`export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`):
  - `npx eslint` on the four touched files: exit 0; `npm run lint --workspace apps/mobile` (`eslint .`): exit 0.
  - `npx tsc -p tsconfig.json` (typecheck): exit 0.
  - `npx jest --ci` (full mobile suite on the branch as it stood): `Test Suites: 76 passed, 76 total`, `Tests: 289 passed, 289 total`.
  - `node --test scripts/*.test.mjs`: `# pass 7`, `# fail 0`.
  - `npm run build --workspace apps/mobile`: exit 0 (`Exported: dist`).
  - `src/cart-write-failure.test.tsx` run three times in a row: 4 passed each time.
## Requests
None.
## Blockers
None.
