# web-P2-L7-T1 - web-phone-card-row task 1: card controls inside the card, wordmark tap target (worker)
Status: done
## Doing
Landed on `lane/web-P2-L7-phone-card-row`: `test:` a6576a8, `fix:` 4d21ecd, this `chore:` log. Gates green (counts below). Nothing running. The e2e run is the manager's.
## Found
- Commits: `a6576a8 test: card controls stay inside the card on a phone` (new `apps/web/e2e/phone-layout.spec.ts`, four tests, box 1.1 ticked); `4d21ecd fix: card controls stay inside the card on a phone` (`product-card.tsx` wrapper `flex flex-col items-start gap-2`; `__root.tsx` wordmark `-my-2 inline-flex min-h-11 items-center`; box 1.2 ticked).
- Tests in the e2e file: `phone` › "card controls stay inside the card on a phone", `phone` › "out-of-stock card on a phone" (pin), `phone` › "wordmark tap target on a phone", describe "six columns" › "card controls stay inside the card in the six-column grid". Helper measures each button, the `s`, every `₹` text and the quantity group against the product link's box horizontally and the list item's box vertically, tolerance 0.5 px.
- Not run: Playwright (manager). Expected red before the fix per design.md: phone card test, six-column test, wordmark test. The out-of-stock pin is green or red on arrival depending on the product's price width; the commit body says so.
- Gates (worktree root, Node 22.23.3): `build packages/ui` exit 0; `lint apps/web` exit 0; `typecheck apps/web` exit 0; `test apps/web -- --run` exit 0, 21 files / 81 tests passed, no Vitest file touched; `build apps/web` exit 0; `git status` clean after the build (only the committed files); `openspec validate web-phone-card-row --strict` valid.
- Deviation from the brief: the lane log file is `.claude/lanes/web-P2-L7-T1.md` as the brief names it; `.claude/lanes/README.md` says one file per LANE-ID. The team lead's `web-P2-L7.md` was read, not written.
- Checked in source: `/search` renders `ProductFeed`, which renders `ProductGrid`, whose cards are `li` elements (the helper's list-item lookup depends on it). The Stepper group label is `Quantity of <name>`.
- Review fix: `cc6272f test: measure the struck MRP only where the card shows one` (the struck MRP is measured only when the card has an `s`; the two struck-MRP tests assert `toHaveCount(1)` first; out-of-stock pick unchanged). Lint and typecheck re-run green; no Playwright.
## Requests
- to web-P2-L7 (team lead): `/opsx:verify` after the manager's e2e is green.
## Blockers
