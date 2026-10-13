# admin-P2-L3-T5b - follow-ups from the reviews of tasks 1 to 5 (task 5b of admin-catalog)
Status: started
## Doing
Group A committed (fb55c11, `test: catalog review test gaps`, 88 green). Group B applied and red as expected (7 failed). Committing `test: catalog review follow-ups`; then the code step.
## Found
- `packages/ui` built once before the first run (exit 0). Baseline before any change: `Test Files  14 passed (14)`, `Tests  84 passed (84)`, as the brief expects.
- Group A tests pass at once by design (tasks 1 to 5 built the behaviour; the reviews found no test). Commit 1 (`test: catalog review test gaps`) is green with no code commit after it for these tests. This is not a missing red step.
  - "a filter changed on a later page asks for the first page", "create a top-level category sends no parent", "a failing create shows a banner and stays on the new page", "any other delete failure shows a banner in the dialog".
  - Added assertions in "the pager moves between pages" and "a category in use cannot be deleted" (test body replaced).
- Group A result: `Test Files  14 passed (14)`, `Tests  88 passed (88)`.
- Group B red run (after the `test:` commit, before any code): `Test Files  4 failed | 10 passed (14)`, `Tests  7 failed | 88 passed (95)`, exactly the brief's count.
  - Failing, each at the place design.md names:
    - `categories.test.tsx` › "a field error from core clears when its field is edited": `toHaveAccessibleDescription('Lower numbers come first.')` at line 253; received "Lower numbers come first. Enter a whole number from 0 to 9999."
    - `categories.test.tsx` › "a sort order error clears when the field is edited": same assertion at line 270, same received text.
    - `image.test.tsx` › "a pick while an upload is pending is ignored and the field stays enabled": `TestingLibraryElementError: Unable to find an element with the text: Uploading the image…` at line 136 (the text does not exist yet).
    - `product-delete.test.tsx` › "after a delete the products table loads afresh": `expect(screen.queryByRole('table')).not.toBeInTheDocument()` at line 107; the table from the first visit is still there.
    - `product-delete.test.tsx` › "after deactivate instead the table and the product show it inactive": same assertion at line 144.
    - `product-form.test.tsx` › "after a save the form shows the product as core stored it": `toHaveValue('Toned Milk')` at line 207; received "Toned Milk  " (the typed spaces).
    - `product-form.test.tsx` › "an amount error clears when its field is edited": `toHaveAccessibleDescription('At most the MRP.')` at line 231; received "At most the MRP. Enter a price from 0.01 rupees up to the MRP, at most two decimals."
## Requests
## Blockers
