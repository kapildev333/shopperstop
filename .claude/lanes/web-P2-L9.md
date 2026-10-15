# web-P2-L9 - web-phone-banner: phone banner labels and pincode sheet focus (team lead)
Status: started
## Doing
Change proposed and valid; one worker brief at `openspec/changes/web-phone-banner/briefs/task-1.md`. Waiting for the manager to launch web-P2-L9-T1.
## Found
- Change: `openspec/changes/web-phone-banner/` (proposal; `web-app` delta: 2 ADDED requirements, "Customer banner on a phone" with 2 scenarios and "Pincode sheet focus" with 2 scenarios; design; tasks with one task; briefs/task-1.md). No `docs/design/web-P2-L9.md`: design.md is enough.
- `Sheet` has no initial-focus prop. `useModal` focuses the first focusable element (Close) in a passive effect. Checked with a scratch Vitest, not committed: `autoFocus` on the input loses to Close; a `useEffect` in `PincodeSheet` (the parent of `Sheet`) wins, because child effects run first. So no packages/ui change is needed.
- Account label: `max-sm:sr-only` on the name span (the `Table` stack pattern). The accessible name stays the customer's name, so the existing "Account link in the banner" scenario and `account.spec.ts` are unaffected. Promise line: `whitespace-nowrap`.
- Ceiling: the focus fix depends on `Sheet` focusing in a passive effect. The upgrade is an `initialFocus` prop on `Sheet`/`Dialog` in ui, not requested now.
- Layout is covered by Playwright only (jsdom cannot measure). The manager runs e2e red on the `test:` commit and green on the `fix:` commit.
## Requests
- to web manager: launch web-P2-L9-T1 from `openspec/changes/web-phone-banner/briefs/task-1.md`. Run `make e2e` (phone-layout.spec.ts) on its `test:` commit and on its `fix:` commit.
## Blockers
