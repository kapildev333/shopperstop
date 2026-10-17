# rider-P5-L3-R4 - review of T4 (5097eaf, 42d51b2, 35615f0, ec14cca)
Status: done
## Doing
Reviewed; verdict changes needed (one real bug, minor gaps).
## Found
- Gates at ec14cca (scratch worktree, removed): rider lint, typecheck clean; test 12 files 80 passed; build ok; openspec validate --all --strict 21 passed.
- Order: test, test, test (fixture fix), feat. Fixture fix is legitimate (spec: "the service still answers it"; the old test moved expiresAt on each poll).
- BUG dispatch.tsx OfferSheet: gcTime 0 never fires because OfferSheet stays mounted, so the disabled query keeps its last offer. Going offline with a sheet open (location refusal) then "Go online" reopens the old, unanswered offer from cache until the first read returns (reproduced in a scratch test with the offer read hanging). Fix: render `{me && online && <OfferSheet/>}`-style (mount the query only while online) or `queryClient.removeQueries({queryKey:['rider','offer']})` when online turns false; design Decision 5 text needs to match.
- Minor: "Offer expired" status survives going offline and navigation until the next decline/expiry (design 6 says cleared when a new offer opens; hidden only because open hides it). Minor: no test for sheet Close icon, none that the countdown is outside a live region.
## Requests
