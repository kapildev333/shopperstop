# rider-P3-L3-R4 - review of task 4 (571c289, e547fa7, ecb6f40)
Status: done
## Doing
Verdict: approve with nits. Detached checkout of ecb6f40: lint clean, typecheck clean, build ok, openspec validate --all --strict 17 passed, test 54 pass / 3 fail (only history.test.tsx, T5's red commit 9ff665f; delivery and location tests all pass).
## Found
- location.ts:25-37: interval starts at effect start, not at the first fix; a fix at 14 s posts at 14 s and 15 s. Nit; start the timer on the first fix.
- delivery.tsx: no Phone icon on Call (Decision 11); apps/rider lacks lucide-react (only ui, web declare it; admin does not). Adding it needs a package.json and lock change (npm 10 lock risk noted in R1): manager/platform call, not worker scope. Acceptable to drop.
- 409 shows no message: matches spec text "close the dialog and read the delivery again".
- ecb6f40 changed locators only (stacked table row text; Call link query).
- fake-geolocation.ts imported by tests only; not in build chunks.
## Requests
## Blockers
