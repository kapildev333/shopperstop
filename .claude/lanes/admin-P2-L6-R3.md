# admin-P2-L6-R3 - review of task 3 (stock image column; the staff dialog on the live row)
Status: done
## Doing
Verdict: approve. R2-1 is closed. No findings that block; one nit.
## Found
Gates (own runs): `make test-web` exit 0: ui 54, admin 215, web 140. `openspec validate --all --strict`: 15 passed, 0 failed. `git status --short` clean.
Order: 7d08628 (test) checked out in a throwaway worktree (removed): `Tests 2 failed | 213 passed (215)`, the two expected tests (stock image tile; refetch-changed row). The row-gone test is green on purpose and guards the `?? editing` fallback. 7e41439 (feat) touches only `stock.tsx` and `staff.tsx` plus the 3.2 tick. Scope clean; `routeTree.gen.ts` untouched.
Correctness: `StockRow.imageUrl` is in core's openapi (optional, "Omitted when the product has no image"), so `ImageTile src={row.imageUrl}` is typed and correct. Alt is `''` (decorative; the product name is the next cell), placeholder is the empty `data-placeholder` tile. `user` in `staff.tsx` looks the row up by id and falls back to the opened row, so an edit never becomes a create (`user` undefined only for `'new'`); `self` follows the live row. Dialog form is not reset on refetch, as decided.
Whole lane diff (`apps/admin`): no combination issue found. e2e specs against core and the demo seed: ids 401/402 and the three seeded staff emails/passwords match `seed/summary.go`; core's `ListStock` left-joins products so a new product shows at Koramangala with quantity 0 and Low stock (< 5); `StaffSession` requires `u.is_active`, so deactivation ends the session as `staff.spec.ts` expects; the redirect URL form `?redirect=%2Fstock` follows `_staff.tsx` (`location.href`). Plausible to pass; not run (no e2e by brief).
Nit (accept): the stock `Image` header is a visible column name for an image-only cell; fine for the spec, and axe accepts empty alt on a decorative image.
## Requests
None.
## Blockers
None.
