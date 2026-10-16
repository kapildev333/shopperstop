# ui-P4-L2-T2 - brief: time helpers (task 2)
Status: brief
LANE-ID ui-P4-L2, task T2, area ui. Change `ui-app-shared`, task 2 (design 5). Parallel with T1 (disjoint files); T3 starts after you and T1 land.

Worktree `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/ui-P4-L2`, branch `lane/ui-P4-L2-app-shared` (shared with the other ui-P4-L2 workers). Setup: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; at the worktree root `test -d node_modules || npm ci`. Read `openspec/changes/ui-app-shared/{proposal,design,tasks}.md` and the delta `specs/design-system/spec.md` first; design.md has the exact interfaces.

Rules: test first. Commit 1 is `test: ...` with only your test files, and the new tests must fail (run them and paste the failure in your report). Commit 2 is `feat: ...`, the smallest code that passes. Commit with a pathspec (`git commit -- <your files>`), never `git add -A`, never amend, never push. Commit identity `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no attribution trailers. Do not edit `tasks.md` (the team lead ticks it) or anything outside your scope; on any open design choice, stop and write it under Blockers in your log.

Gates (worktree root), all green before you report: `npm run lint --workspace packages/ui`, `npm run typecheck --workspace packages/ui`, `npm run test --workspace packages/ui -- --run`, `npm run build --workspace packages/ui`, then `make test-web`. Never run `docker compose` or touch containers.

Keep your own log `.claude/lanes/<your id>.md` (format in `.claude/lanes/README.md`) current; commit it with your feat commit.

## Scope
`packages/ui/src/app/time.ts`, `packages/ui/src/app/time.test.tsx`, `.claude/lanes/ui-P4-L2-T2.md`. Do not touch `src/app/index.ts` (T1 creates it, T3 adds your export line).

## Scenarios and the failing tests to start from
`packages/ui/src/app/time.test.tsx` › `relative times in whole minutes`, `stamp in the stores' time zone`, `useSince keeps its text current`. Exact WHEN/THEN in the delta. For `useSince`: a tiny component `function Ago({ at }: { at: string }) { return <p>{useSince(at)}</p> }`, `vi.useFakeTimers()`, `vi.setSystemTime(new Date(at))`, `render`, expect `just now`, then `act(() => { vi.advanceTimersByTime(60_000) })`, expect `1 min ago`; `afterEach(() => vi.useRealTimers())`.

## Commits
1. `test: relative and stamped times` (red: missing `./time`).
2. `feat: since, useSince and when in the app entry`: `src/app/time.ts` copied in behaviour from `apps/rider/src/format.ts` (`since`, the 5 000 ms `everyFewSeconds`, `useSince`, the module-level `Intl.DateTimeFormat` for `when`); not `itemCount`.

## Done when
Gates green. If T1 has not landed yet, `make test-web` and the build still run (your file is not exported until T3); say so in your report.
