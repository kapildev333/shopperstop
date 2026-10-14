# core-P2-L6-t2 - seed.Summary printed by core-admin seed-demo (task 2 of core-seed-demo)
Status: done
## Doing
Task 2 landed on `lane/core-P2-L6-seed-demo`: test `a1577eb` (red, build failure `undefined: seed.Summary`), feat `5a36b25` (`summary.go`, package comment, `fmt.Fprint(stdout, seed.Summary)`, ticks 2.1 and 2.2). Gates green; task 3 next.
## Found
- `seed.Summary` (`internal/seed/summary.go`) is the printed text; `core-admin seed-demo` now prints it verbatim on success. The old "demo accounts loaded" line is gone; nothing else in the repo matched that string.
- `TestSummaryMatchesSeed` reads `docs/postman/local.postman_environment.json` (read only); the four Postman ids in the summary match the environment file.
- Design followed verbatim; no deviation.
- Closes core-P2-L2's cosmetic filing (the printer said "demo accounts loaded" and no stores). The summary lists stores, addresses, products and orders; the stock rows of core-P2-L4 are not printed (the design lists no stock ids).
## Requests
- none
## Blockers
none
