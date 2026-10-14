# Worker brief: admin-P2-L4 task 3: step A, fixes from the review of task 2; step B, store switch dialog, save failures, the 500-row limit, URL values and the store's name for store staff

- LANE-ID: admin-P2-L4 (worker log: `.claude/lanes/admin-P2-L4-T3.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L4` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L4-admin-stock` (commit here; never push)
- OpenSpec change: `admin-stock`, task 3 in `openspec/changes/admin-stock/tasks.md`
- Starts after: task 2 landed and reviewed

## Read first
1. `openspec/changes/admin-stock/tasks.md`, the header and section 3.
2. `openspec/changes/admin-stock/design.md`, sections "Task 3 step A" and "Task 3 step B" under "Code and tests per task". Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-stock/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/src/stock.test.tsx` (replace TWO landed tests, one in each step, and append the step-A and step-B blocks; change nothing else)
- `apps/admin/src/stock-rules.test.ts` (step B: append its block at the end)
- `apps/admin/src/routes/_staff/stock.tsx` (replace the whole file in step A, and again in step B)
- `apps/admin/src/stock.ts` (step B: replace the whole file)
- `apps/admin/e2e/stock.spec.ts` (step B: one line added; written only, never run)
- `openspec/changes/admin-stock/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L4-T3.md` (your log)

## Step A: fixes from the review of task 2

### Scenarios covered
- Stock save › Edit typed during a save
- Stock save in progress › Focus through a save, Second press during a save
- Stock edits › Value read as the stored quantity
- Stock store switch with unsaved edits › Return after a store change in the URL, Save answered after a store change

### Failing tests to start from
`apps/admin/src/stock.test.tsx`:
- "an edit typed while a save is in flight stays unsaved, and the save still finishes once and is confirmed" (it replaces the landed "an edit typed while a save is in flight stays unsaved")
- "Save changes keeps keyboard focus through a save and is never disabled"
- "a value that reads as the stored quantity is no edit, and Discard with nothing unsaved changes nothing"
- "a store changed through the URL drops the edits for good: they are not back on return"

Green as soon as it is written, on purpose (task 2 already built the check): "a save that answers after the store changed leaves the other store's edits alone".

### Steps
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
0. Run `npm run test --workspace apps/admin -- --run` and note the summary: expected `127 passed (127)`.
1. In `apps/admin/src/stock.test.tsx`: (a) replace the whole test "an edit typed while a save is in flight stays unsaved", from its `test(` line to its closing `})`, with the test in design.md "Task 3 step A" headed "replace one test"; (b) append the step-A block at the end of the file (it starts with one empty line; keep it). Run the admin tests: expected `Tests  4 failed | 127 passed (131)`. Record the summary and the four names. Commit: `test: stock save in progress, values read as stored, edits dropped on a store change`. Tick 3.1.
2. Replace `apps/admin/src/routes/_staff/stock.tsx` whole with the step-A block. Run the admin tests: expected `Tests  131 passed (131)`.
3. Run the gates. Commit the file and the 3.2 tick: `fix: stock save stays attached and focusable, edits dropped on any store change`.

### Notes for step A
- "Save changes" has no `loading` and no `disabled` any more: it is `aria-disabled` while there is nothing to save or a save runs, and reads "Saving…" (with the one character `…`, not three dots) while a save runs.
- `forget()` calls `save.reset()` only when no save is pending. Do not call `save.reset()` anywhere else.
- The line `if (draft.store !== storeId) setDraft(...)` sits in the component body on purpose (state adjusted during render, like `shownQ`). Do not move it into a `useEffect`.
- In step A the "Store" selector still switches at once and a failed save still shows nothing: those are step B.

## Step B: store switch dialog, save failures, the 500-row limit, URL values, the store's name

### Scenarios covered
- Stock store switch with unsaved edits › Switch asks first
- Stock save failures › Save refused for a deleted product, Other save failure
- Stock save › More than 500 edits
- Stock URL values › Unreadable page or filter, Over-large page, Over-long search
- Stock store for store staff › Store staff see their own store (now with the store's name and its request), Store name unavailable
- Stock table › Stock listed (the request list of an admin)
- Stock against core › Store staff set stock at their own store only: one line added to the spec; run in task 4

### Failing tests to start from
`apps/admin/src/stock.test.tsx`:
- "store staff see their own store by name and no store selector" (it replaces the landed "store staff see their own store and no store selector")
- "switching store with unsaved edits asks first"
- "a save refused for a deleted product says so and keeps the edits"
- "any other save failure shows a banner, keeps the edits and can be retried"
- "a page in the URL beyond what core accepts is cut to one it does, then to the last page"
- "a search in the URL loses NUL bytes and is cut to the 100 characters core takes"
- "store staff get the stock without a store name when the name cannot be read"

`apps/admin/src/stock-rules.test.ts`:
- "one save takes the first 500 edits, in the order they were made"

Green as soon as they are written, on purpose (task 1 already built the behaviour): "?%s in the URL is read as page 1 with the filter off" (three runs: `page=banana`, `page=1.5`, `lowStock=banana`) and "an admin is not asked for a store name: the selector names the store".

### Steps
4. In `apps/admin/e2e/stock.spec.ts` add the one line from design.md "Task 3 step B" (the block shows the three lines that are there and the four they become; the new line is `await expect(page.getByText('Store: Koramangala')).toBeVisible()`). Run `npm run lint --workspace apps/admin` and `npm run typecheck --workspace apps/admin`; both must pass. Do not run the spec. Commit: `test: stock page against core names the store for store staff`. Tick 3.3.
5. In `apps/admin/src/stock.test.tsx`: (a) replace the whole test "store staff see their own store and no store selector", from its `test(` line to its closing `})`, with the test in design.md "Task 3 step B" headed "replace one test"; (b) append the step-B block at the end of the file. In `apps/admin/src/stock-rules.test.ts` append its step-B block. Each appended block starts with one empty line; keep it. Run the admin tests: expected `Tests  8 failed | 134 passed (142)` (seven in `stock.test.tsx`, one in `stock-rules.test.ts`). Record the summary and the names. Commit: `test: stock store switch, save failures, URL values and store name`. Tick 3.4.
6. Replace `src/stock.ts` and `src/routes/_staff/stock.tsx` whole with their step-B blocks. Run the admin tests: expected `Tests  142 passed (142)`.
7. Run the gates (`make test-web`: ui 54, admin 142, web 20). Commit the two files and the 3.5 tick: `feat: stock store switch dialog, save failures, URL values and store name`.

### Notes for step B
- The dialog's buttons are "Cancel" (from `DialogFooter`) then "Discard and switch", in that order. "Discard and switch" only closes the dialog and navigates: the edits are dropped by the store change itself (step A).
- The store's name for store staff is plain text in the filter card, shown only when `GET /stores/{id}` answered. No skeleton, no error, no retry for it.
- `validateSearch` holds a NUL character written as `'\0'` in the source (backslash, zero, inside quotes). Copy it exactly; do not paste a real NUL byte.
- The search form's name becomes "Search stock"; the field and the button keep their names "Search".

## Gates before the `fix:` commit and again before the `feat:` commit
1. `make test-web` exits 0 (ui, admin and web: lint, typecheck, test, build).
2. `git status --short` lists only files in your scope. `apps/admin/src/routeTree.gen.ts` must NOT be listed: this change never alters it. If it is listed, stop and report.
3. `openspec validate admin-stock --type change --strict` says valid.
Never run `make e2e`, `npx playwright`, `npm run e2e`, `make db`, `make dev` or any docker command. The manager holds the e2e slot.

## Rules
- Commit order is fixed, five commits: `test:` (step A, red), `fix:` (step A), `test:` (the e2e line), `test:` (step B, red), `feat:` (step B). Each code commit carries its ticks in tasks.md. Commit identity is the repo git config; no attribution or co-author lines.
- Tick the boxes in `openspec/changes/admin-stock/tasks.md` with the Edit tool (`- [ ]` to `- [x]`), only the boxes of this task.
- Colours only from the semantic tokens; components only from `@shopperstop/ui`; no new dependency; no `package.json` change. Do not import `lucide-react` (it is not an `apps/admin` dependency).
- Do not edit `apps/admin/src/fake-core.ts`: the stock fixtures live in `src/stock.test.tsx` on purpose (design.md Decision 15).
- Counts are measured on this branch with tasks 1 and 2 landed (admin suite 127). If the suite does not start at the number step 0 names, stop and report.
- This task replaces `src/routes/_staff/stock.tsx` twice: with the step-A block for the `fix:` commit, then with the step-B block for the `feat:` commit. Do not skip to the step-B block: step A's tests must be seen red, then green, on their own.
- A block that does not compile, a count that differs for any other reason, or any choice design.md leaves open: stop, write it in your lane log under `## Blockers`, and report. Do not decide it yourself, and never edit a test to make it pass.

## Report
The commit hashes, the red and green Vitest summaries, the `make test-web` exit code, `git status --short`, and anything you found.
