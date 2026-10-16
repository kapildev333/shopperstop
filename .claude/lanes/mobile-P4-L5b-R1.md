# mobile-P4-L5b-R1 - review of lane mobile-P4-L5b (mobile-e2e-flow)
Status: done
## Doing
Reviewed 3b63982 and the change artifacts. Verdict: approve.
## Found
- Gates: mobile `npm run lint` and `npm run typecheck` clean; `openspec validate --all --strict` 20 passed. make e2e not run (manager's).
- Spec 2 section 13 steps and the scenario are all covered; merge exercised (guest line added after sign-out, bar counts qa+1, sheet and checkout show qa and 1). Staff half uses only POST /admin/auth/sign-in and POST /admin/orders/{id}/status (both in openapi.json). Bite check recorded in T1 log (line 203, red). No fixed sleeps. Unique emails.
- Non-blocking 1 (flow.spec.ts:22-31 and design Decision 2): orderPick filters quantity === 10, so each placed order removes its product from the list. Files run in parallel workers, so a test that resolves its index after orders.spec/checkout.spec have ordered gets a shifted list and could land on the same product as another test (stock 10 absorbs small orders; flaky only if a pick is ordered at qa up to 10 twice). Same pattern as the other suites; fix later by resolving picks once in global-setup.
- Non-blocking 2 (flow.spec.ts:109-113): axe runs on the category screen right after the URL changes, before products may have rendered; add an expect on a product or heading first. Home after sign-in (157-158) and the search screen at the second visit have no axe; fine, they were scanned earlier.
- Non-blocking 3 (flow.spec.ts:127-139): "Add one" clicks are not awaited individually and the test signs out right after Close; if the last cart mutation has not reached the server, the merged quantity could read qa-1. Passed in the manager run; if it flakes, wait for the cart bar to read `${qa} items` before step 6.
## Requests
none
## Blockers
none
