# admin-P3-L1-R1 - review of task 1 (ui swaps and the stacked cancel dialog) (reviewer)
Status: done

## Verdict
Approve with nits. No correctness, security or scope finding that blocks task 2.

## Gates (run by me in /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P3-L1-review, HEAD 5f53bb8, Node 22.23.3)
- `npm ci`: ok.
- `make test-web`: exit 0. ui 28 files / 71 tests, admin 25 files / 295 tests, web 26 files / 153 tests. Admin matches the worker's `295 passed (295)`.
- `openspec validate admin-riders --strict`: "Change 'admin-riders' is valid".
- Not run: `make e2e`, Playwright, docker, `make db`, `make dev`. The red run of 23b0a46 was not re-run; read instead: the old sheet used `open={!asking}`, so the new assertions (the sheet and the cancel dialog both present, `getAllByRole('dialog')` equal to `[sheet]` after Keep, focus on the sheet's button and on "Cancel result") cannot hold without 3c8fe94.

## Test-first
05e2eec (e2e specs only, no product code), 23b0a46 (tests only), 3c8fe94 (order-sheet.tsx only), 5f53bb8 (refactor, no new test, allowed by design decision 13; idle.ts deleted as the manager decided). Order is right.

## Spec coverage (Order cancel with a reason)
- Order cancelled: test asserts one POST body, sheet the only dialog, "Cancel result" group focused, status role, Cancelled badge, reason line. Covered.
- Reason missing: first test asserts the sheet still open under the dialog, nothing sent, "Enter a reason.", cleared on typing. Covered.
- Keep order: Keep and Escape each leave `[sheet]` as the only dialog, "Cancel order" focused, no POST. Covered.
- Cancel offered unchanged.

## Findings
1. NIT, `apps/admin/src/routes/_staff/stock.tsx:8-9`. Removing the local `idle` constant left two consecutive blank lines before `function StoreStock`. Delete one.
2. NIT, `apps/admin/src/order-sheet.tsx:79-83` (focus effect). Correct for every path I traced: on success the sheet's "Cancel order" button is gone (status no longer placed/accepted), the Dialog cleanup's `previous.focus()` is a no-op on a removed node, `activeElement` is `body`, and the effect moves focus to the group; the 409 case is the same. The `document.activeElement === document.body` guard also keeps a user who moved focus meanwhile. Accepted. One untested edge: a cancel that succeeds while the user has already tabbed inside the sheet keeps their focus (intended).
3. NIT, a11y, `order-sheet.tsx:104`. The sheet is no longer unmounted/hidden under the dialog. Both are `aria-modal`; ui's `use-modal` layer stack gives Escape and Tab to the top panel only, so keyboard behaviour is right, but the sheet content stays in the accessibility tree for screen readers that ignore `aria-modal`. This is the design's decision (ui stack), not a defect; axe in e2e (task 5) will cover the stacked state. Accept.
4. NIT, `order-sheet.tsx:107`. `className="empty:hidden"` relies on the group holding no children when there is no result (React renders `false` as nothing, so it holds). Fine; a comment is not needed, but any whitespace added inside the div later would show an empty bordered-less box and keep a named group in the a11y tree.
5. NIT, behaviour change in the swaps, accepted: ui `ImageTile` adds `loading="lazy"` and a basket icon in the placeholder, and has no border, so the three call sites add `border border-line` (checked: categories, products, stock). `data-placeholder` is kept, existing tests pin it. Button `compact` is `h-11 sm:h-8`, so the order-number buttons get the 44 px phone target the convention asks for. `VisuallyHidden live` keeps the region mounted and `role="status"`.
6. NIT, `apps/admin/src/image.tsx`. After the swap it still holds the upload field; its name is unchanged and typecheck passes. No leftover `idle` or local `ImageTile` anywhere in `apps/admin/src` (grep clean).

## e2e specs (read, not run)
- `riders.spec.ts` matches the admin-riders delta scenario: four seeded riders, Arjun Rao at Koramangala and Active, Indiranagar shows rider1 and rider2 only, create at the preselected store, reload, set Inactive, store staff in a second context see Dashboard, Orders, Stock, Riders, "Store: Koramangala", no selector, two rows. Axe on the list, the create dialog (open, filled), the edit dialog and the staff page. The row locator filters on `@shopperstop.local`, so the header row is excluded; the new rider's email also matches it, so counts after creating are not asserted (correct). Seeds: rider emails and names depend on the rider service seed (`services/rider/internal/seed`), which the comment names; I did not find them on this base by grep because the rider service lives on main; confirm in task 5's run.
- `orders.spec.ts` adds "Open" on the Koramangala card (task 3) and "Rider: Arjun Rao" / "Delivered by Arjun Rao" on SS-DEMOAAAB with axe, which needs core's demo seed change (design.md lists it as core's, blocking task 5's run). Plausible and matches the delta scenario text.
- `auth`, `staff`, `stores` specs only add "Riders" to the admin nav lists and to store staff's (Dashboard, Orders, Stock, Riders), consistent with the Role-based navigation delta.
- No scope creep: files touched equal the brief's scope list plus the worker log and tasks.md ticks.

## Needless complexity
None. The new group is the smallest way to give the keyboard a place after the button disappears.
