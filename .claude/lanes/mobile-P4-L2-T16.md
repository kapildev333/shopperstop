# mobile-P4-L2-T16 - mobile-serviceability-catalog task 16: e2e catalog scenarios against core
Status: done
## Doing
Task 16.3 worker run: R1 fixes landed (commits below), Jest 68 suites / 237 tests green 3 of 3, lint, typecheck, build, openspec 20 passed; `make e2e` from the worktree root running (manager holds the slot).
## Found
- Commits: 854831d `test:` catalog e2e scenarios (red: notices against core failed axe color-contrast); 0285a4f `fix:` store notices on surface; fe4e266 `fix:` comment without the canvas hex.
- 7c0203c `test:` orders.spec.ts `signedIn()` presets `shopperstop:pincode` to 560034 (manager decision 1). Red before: 3 failed; green after: 3 passed.
- R1 fixes: 676978a / f49171b `test:` red for dismiss-during-lookup and double go; 98cf117 `fix:` next() returns when the form has unmounted (dismissed) and onSubmitEditing is guarded by pending; 1b5fafb `refactor:` StatusMessage in StyleSheet; 7872640 `fix:` store-change title guard; 2a7f7a4 `chore:` RNTL asyncUtilTimeout 5000.
- The double-go test is a guard, not a red test: `resolvePincode` goes through `queryClient.fetchQuery`, which already dedupes the in-flight lookup, so the request count is 1 on the old code too. It is red for the dismiss path only.
- The 5 "not wrapped in act" warnings in pincode-sheet.test.tsx predate this change (same on the 7c0203c test file).
- The store-change title guard has no test: the dialog content is hidden while closed, so the undefined title is not observable.
- Pending decision for the manager: L5a's request (`test` script in apps/mobile/package.json) is still open and outside this brief; not touched.
## Requests
- to mobile manager: none new.
## Blockers
None.
