# rider-P3-L3-R2 - review of task 2 (e2e suite, commit 879f39a)
Status: done
## Doing
Review finished: approve with nits.
## Found
- Gates: eslint clean and e2e files typecheck clean at 879f39a (the only tsc errors are `exact` in src/ready.test.tsx, T3's); `openspec validate --all --strict` 17 passed. Playwright not run (slot held).
- Config ports, env, proxies, global setup refusal, locators and the customer-token choice (the shopper who placed the order) are right.
- Nits: rider1 signs in up to 4 times per run (smoke UI + one API per worker for smoke, deliveries, phone-layout), so 3 reused-server runs an hour exceed 10; deliveries.spec has no test.slow() under a 30 s default; tap-target rule may flag non-inline wordmark/nav links.
## Requests
## Blockers
