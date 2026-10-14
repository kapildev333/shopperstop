# Worker brief: admin-P2-L4 task 3b, follow-ups from the review of task 3

- LANE-ID: admin-P2-L4 (worker log: `.claude/lanes/admin-P2-L4-T3b.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L4` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L4-admin-stock` (commit here; never push)
- OpenSpec change: `admin-stock`, task 3b in `openspec/changes/admin-stock/tasks.md`
- Starts after: task 3 landed and reviewed (`.claude/lanes/admin-P2-L4-R3.md`)

## Read first
1. `openspec/changes/admin-stock/tasks.md`, the header and section 3b.
2. `openspec/changes/admin-stock/design.md`, section "Task 3b" under "Code and tests per task", and Decisions 29 to 32. Every block you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-stock/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/src/api.test.ts` (append the task-3b block at the end; change nothing above it)
- `apps/admin/src/api.ts` (replace the whole file with the task-3b block). This file is the app's client and is normally not a page lane's; it is in scope for this task by the manager's ruling, because the fault is fixed where every caller routes through.
- `apps/admin/src/stock.test.tsx` (append the task-3b block at the end; change nothing above it)
- `apps/admin/src/stock-rules.test.ts` (replace line 2, the import from `./stock`, and append the task-3b block at the end)
- `apps/admin/src/stock.ts` (replace the whole file with the task-3b block)
- `apps/admin/src/routes/_staff/stock.tsx` (replace the whole file with the task-3b block)
- `openspec/changes/admin-stock/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L4-T3b.md` (your log)

Do NOT edit any other file under `apps/admin/src`. About twenty places there read `if (error) throw error.error`; they stay exactly as they are. The change in `src/api.ts` is what makes them right.

## Scenarios covered
- Failure answers without core's error body › Failure without core's error body, Core's error passes through, Success without a body, 401 without core's error body
- Stock save failures › Save answered without core's error body
- Stock URL values › Search ending in an emoji, Search cleaned
- Stock save result stays with its visit › Failed save, then another store and back; Saved, then another store and back; Save fails after its edits were discarded
- Stock store switch with unsaved edits › Escape on the dialog

## Failing tests to start from
`apps/admin/src/api.test.ts`:
- "a failure answer with %s reaches the caller as an internal error with its status" (one `test.each`, four runs: no body, an empty body with its length, a plain-text body, JSON that is not core's error)
- "a 401 without core's error body still ends the session and is an error to the caller"

`apps/admin/src/stock.test.tsx`:
- "a save answered without core's error body is a failed save: alert, edits kept, never "Stock saved.""
- "a search in the URL whose 100th character is an emoji is cut after it, never through it"
- "after a failed save and "Discard and switch", returning to the store shows no alert"
- ""Stock saved." is not shown again after leaving the store and returning"
- "a save that fails after its edits were discarded shows no alert asking to try again"

`apps/admin/src/stock-rules.test.ts`:
- "a search with %s is cleaned to what core takes" (one `test.each`, five runs)

Green as soon as they are written, on purpose (the behaviour is landed; no code follows for them): `src/api.test.ts` › "a failure answer with core's error body reaches the caller unchanged" and "a success answer without a body is still a success"; `src/stock.test.tsx` › "Escape closes the switch dialog and keeps the store and the edits".

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
0. Run `npm run test --workspace apps/admin -- --run` and note the summary: expected `142 passed (142)`.
1. Append the task-3b blocks from design.md at the end of `src/api.test.ts` and of `src/stock.test.tsx`. In `src/stock-rules.test.ts` replace line 2 (the import) with the line design.md gives, and append its task-3b block. Each appended block starts with one empty line; keep it. Run the admin tests: expected `Tests  15 failed | 145 passed (160)`: five in `api.test.ts`, five in `stock.test.tsx`, five in `stock-rules.test.ts` (`cleanSearch is not a function`). Record the summary and the names. `npm run typecheck --workspace apps/admin` fails at this point (the rules test imports `cleanSearch`, which `src/stock.ts` does not export yet): expected for the red commit. Commit: `test: failure answers without core's error body, search cut by code point, save result per visit`. Tick 3b.1.
2. Replace `src/api.ts`, `src/stock.ts` and `src/routes/_staff/stock.tsx` whole with their task-3b blocks. Run the admin tests: expected `Tests  160 passed (160)`.
3. Run the gates. Commit the three files and the 3b.2 tick: `fix: failure answers without core's error body are failures; search cut by code point; save result per visit`.

## Notes for this task
- Copy the escapes as written, never as real characters: `'\0'` (backslash, zero) in `src/stock.ts` and in the first case of the rules test; `\uD800-\uDFFF` in the regular expression in `src/stock.ts`; `\uD83D` in the fourth case of the rules test. The emoji 😀 in the tests is a real character and stays one.
- `onResponse` in `src/api.ts` becomes `async`. Its first lines, the 401 rule, are unchanged and stay first.
- In `src/api.ts` the body is read from `response.clone()`, never from `response` itself: the caller still has to read the original.
- In the route, `saved` now compares `visit`, not the store, and the alert also needs `count > 0`. `visit` is raised in the same line that empties the draft on a store change. Do not move that line into a `useEffect`.
- The search field keeps `maxLength={maxSearch}`; do not remove it.

## Gates before the `fix:` commit
1. `make test-web` exits 0 (ui 54, admin 160, web 91: lint, typecheck, test, build).
2. `git status --short` lists only files in your scope. `apps/admin/src/routeTree.gen.ts` must NOT be listed: this change never alters it. If it is listed, stop and report.
3. `openspec validate admin-stock --type change --strict` says valid.
Never run `make e2e`, `npx playwright`, `npm run e2e`, `make db`, `make dev` or any docker command. The manager holds the e2e slot.

## Rules
- Commit order is fixed: the `test:` commit first with the tests failing, then one `fix:` commit with the code and the tick. Commit identity is the repo git config; no attribution or co-author lines.
- Tick the boxes in `openspec/changes/admin-stock/tasks.md` with the Edit tool (`- [ ]` to `- [x]`), only the boxes of this task.
- Colours only from the semantic tokens; components only from `@shopperstop/ui`; no new dependency; no `package.json` change.
- Counts are measured on this branch with tasks 1 to 3 landed (admin suite 142). If the suite does not start at the number step 0 names, stop and report.
- A block that does not compile, a count that differs, or any choice design.md leaves open: stop, write it in your lane log under `## Blockers`, and report. Do not decide it yourself, and never edit a test to make it pass.

## Report
The commit hashes, the red and green Vitest summaries, the `make test-web` exit code, `git status --short`, and anything you found.
