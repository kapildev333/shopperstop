# rider-P3-L3-R7 - review of rider-P3-L3-T7
Status: done
## Doing
Verdict approve with nits (3874305, ea09b8c, 3e00629).
## Found
- Red at 3874305: 2 failed (2 sends vs 1; dialog gone after Cancel). Green at 3e00629: rider lint, typecheck clean; 59 of 59 tests; openspec validate 18 passed.
- Rider card second check cannot race: web's name comes from order.riderName (same payload as the status text), delivery read is only a fallback.
- Nit: phone-layout failure text rounds 43.5 to 44.
## Requests
## Blockers
