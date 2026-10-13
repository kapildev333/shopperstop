# admin-P2-L2-T5 - stores e2e against the real core (OpenSpec change admin-stores, task 5)
Status: done
## Doing
Task 5 done: 5.1 e2e run against the real core on 18080 with the Makefile's `E2E_ENV`, 6 passed on three runs. No change to `e2e/stores.spec.ts`, so the commit is the tick and this log. Waiting for the manager to take the slot back.
## Found
- Ports before the run: 18080 and 15174 free (`nc -z`). After the runs: both free again, Playwright stopped its webServers.
- Setup: `npm run build --workspace packages/ui` exit 0; `npm run build --workspace apps/admin` exit 0; then `CI=1 npm run e2e --workspace apps/admin`, with the five `SHOPPERSTOP_CORE_*` variables exported from the Makefile's `E2E_ENV`. Global setup ran core's `migrate` ("nothing to apply") and `seed-demo --reset` ("demo accounts loaded").
- Run 1 (default reporter, no names): `6 passed (7.9s)`, exit 0.
- Run 2 (`--reporter=list`), `6 passed (6.1s)`, exit 0:
  ```
  ✓  3 [chromium] › e2e/smoke.spec.ts:4:1 › not found passes axe (439ms)
  ✓  4 [chromium] › e2e/smoke.spec.ts:11:1 › preview proxies to core (17ms)
  ✓  1 [chromium] › e2e/auth.spec.ts:9:1 › admin signs in, reloads and signs out (1.3s)
  ✓  5 [chromium] › e2e/auth.spec.ts:44:1 › wrong password shows the error (647ms)
  ✓  2 [chromium] › e2e/stores.spec.ts:33:1 › admin edits a store and meets the pincode conflict (2.4s)
  ✓  6 [chromium] › e2e/stores.spec.ts:68:1 › store staff open the stores page (665ms)
  6 passed (6.1s)
  ```
- Run 3 (`--reporter=list`), `6 passed (5.8s)`, exit 0: the same six names, in the order the workers finished (`smoke`, `smoke`, `auth`, `auth`, `stores`, `stores`), each passing, durations 16 ms to 1.3 s.
- Restore and idempotence: runs 1 to 3 each reseeded through the global setup. The stores test puts back promised minutes 10 and removes `560001`; the second and third runs passed from the same seed, so no restored row broke a later run. The pincode conflict wrote nothing.
- Failures: none in any run. No fix, no weakened assertion, no product or design question.
- Tree: `git status --short` clean after the runs (the build and e2e wrote only gitignored output).
- Note for the reviewer: run 1 wrote its admin build log to a path I mistyped; the file was not created (no stray file found in the worktree parent or `/Users/kapilsoni`), and nothing outside the worktree was changed.
## Requests
- none
## Blockers
None.
