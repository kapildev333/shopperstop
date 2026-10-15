# admin-P2-L6-R2 - review of task 2 (the staff user create and edit dialog)
Status: done
## Doing
Verdict: approve. R1-1 and R1-2 are closed. Two nits, neither blocks task 3.
## Found
Gates (own runs): `make test-web` exit 0: ui 54, admin 212, web 140. `openspec validate --all --strict`: 15 passed, 0 failed. `git status --short` clean; `routeTree.gen.ts` not in the diff.
Order: `f6383d2 test` holds only `staff-dialog.test.tsx`, `staff.test.tsx`, `staff-fake.ts` and the 2.1 tick (no product code). Checked out in a throwaway worktree (removed): `Tests 24 failed | 188 passed (212)`, the 23 dialog tests (test.each rows counted) plus the refetch test. `222831c feat` is green at 212. The worker's early-written feat files never reached a commit. Scope: only brief paths.
Coverage: every scenario of Staff user create, change, own account, form errors, save in progress and passwords, and the failed-refetch-while-stores-load scenario, has a test; each fails on the missing dialog. R1-1: per-read alert rule in `staff.tsx`, tested. R1-2: lowercase compare in `staff.ts` and `staff-fake.ts`, mixed-case `Jaya@` in the create test, ponytail comment names the punctuation ceiling.
Correctness read: Cancel first (DialogFooter); submit is `aria-disabled` + "Saving…", no `disabled`/`loading`; `close()` and `submit()` ignore while pending; `edit()` resets only when not pending; `gcTime: 0` on the mutation; PATCH sends the diff only, nothing changed closes with no request; own row hides Status and shows the line, banner and `meQuery` updated, `router.invalidate()` called; 409 on `email` and 400 on a form field go to the field, else the banner; bodiless failure is code `internal` via `api.ts`; admin role never sends `storeId`; the dialog is mounted only once stores are held. No scope creep, no new dependency, no console.

R2-1 nit, accept: `staff.tsx` `editing` holds a snapshot of the row. If a background refetch changes that user while the dialog is open (for example another admin deactivates them), `changes()` still diffs against the old snapshot, so "Active" shown would send nothing. Rare; the fix (store the id, look the row up in `list`) is not worth a new test now.
R2-2 nit, accept: Edit button text "Edit" with `aria-label` "Edit <email>" is correct for label-in-name; e2e `staff.spec.ts` counts three `Edit` buttons and must keep the row to that one button (it does).
## Requests
None.
## Blockers
None.
