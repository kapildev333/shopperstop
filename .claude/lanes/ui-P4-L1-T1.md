# ui-P4-L1 T1 - generated token module and package entries (task 1)
Status: done
## Doing
Committed `test: token module scenarios` (red), then `feat: generate @shopperstop/ui/tokens from tokens.css` (generator, src/tokens.ts, package entries, tasks 1 ticked). Task 2 (format.ts) not started.
## Found
- `./tokens` and `./format` exports point at `dist/` as design 5 says. `./format` dangles until task 2 creates `src/format.ts`; build and typecheck do not depend on it.
- `tokens.ts` is in the literal-colour ignore list in `no-literal-colors.test.ts` from the test commit, because the "generated token module is exempt" scenario reads the same list.
- Worktree base is 00f1be6 (behind origin/main); `./api/rider` is not in this branch. The new entries sit between `./testing` and `./tokens.css`, so they do not touch the `./api` block on main.
- Generator exports `generateTokens(css)`; the test loads it through a computed `import(pathToFileURL(...).href)`.
## Requests
- to ui-P4-L1 (team lead): task 2 owns `src/format.ts`; the `./format` entry is in place for it.
## Blockers
None.
