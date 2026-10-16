# rider-P3-L3-T7 - acceptance fixes (task 7 of rider-app)
Status: done
## Doing
Done: 7.1 red (3874305), 7.2 fix (ea09b8c), 7.3 e2e spec edits and the rider card flip (commit 3). Gates: make test-web exit 0, openspec validate 18 passed.
## Found
- Red run (7.1), `npx vitest run src/location.test.tsx src/ready.test.tsx`: `Tests 2 failed | 17 passed (19)`; `× cancel waits for a pending pick up`, `× a late first fix starts the count`. Location: `AssertionError: expected [ Array(2) ] to have a length of 1 but got 2` (the interval fired at 15 s). Ready: the dialog was gone after Cancel (`Unable to find an accessible element with the role "dialog" and name "Pick up SS-AAAA0001?"`).
- Green (7.2): rider suite 59 of 59 pass; tsc and eslint clean.
- `webRiderCard` removed rather than kept at `true`: the flip makes the two rider-card checks hard, so the guard and the skipped-step annotation path have no use. The constant and `test.info()` annotation are gone from flow.spec.ts.
- Rider card checks (flow.spec.ts): `getByRole('region', { name: 'Rider', exact: true }).getByText(name, { exact: true })`, timeout 20 s, at the out-for-delivery step and after delivered. The manager should watch these in the e2e run: the card polls every 10 s on web, so the 20 s timeout is the only margin.
- phone-layout.spec.ts: the comparison is unrounded; the failure text rounds. A 43.5 px target fails and prints as `height: 44`, which reads oddly; say so if the manager wants one decimal in the text.
- Not run (slot held by another manager): Playwright and make e2e. Typecheck and lint of the e2e specs are clean.
## Requests
## Blockers
