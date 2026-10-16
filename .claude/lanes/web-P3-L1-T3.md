# web-P3-L1-T3 - web-rider-tracking task 3: ui swaps, ChoiceGroup at checkout and ImageTile everywhere (worker)
Status: done
## Doing
2026-10-15: commit 1 (red): the five checkout tests and the three e2e address locators moved to radios. Task 3.1 ticked.
## Found
- Red on commit 1: exactly five failing in `src/checkout.test.tsx` (24 tests, 19 pass): "default address chosen", "another address chosen", "address not served", "choosing another address clears the refusal alert", "the address choice is named by its visible text".
- Gates on commit 1: `npm run lint --workspace apps/web` exit 0; `npm run typecheck --workspace apps/web` exit 0.
- Commit 2 (feat, Decision 7 checkout part): `Chip` out, `ChoiceGroup` and `Choice` in; the address `<ul>` wrapped in `ChoiceGroup label="Deliver to"`. checkout.test.tsx 24 of 24 pass. Full web suite 26 files, 163 tests pass. Gates: lint exit 0; typecheck exit 0; test 26 files, 163 passed; build exit 0; git status clean after build; `openspec validate web-rider-tracking --strict` valid. Task 3.2 ticked.
- Shell note: the worktree's sed is BSD; `sed -i` takes an explicit `''`. The web `prettier` binary does not re-indent the wrapped `<ul>`; indentation was done by hand.
- Commit 3 (refactor, Decision 7 ImageTile part): app `ImageTile` and the `ShoppingBasket` import deleted from `product-card.tsx`; five call sites import `ImageTile` from `@shopperstop/ui` and pass `alt=""` `className="w-full"`. No test changed. Suite 26 files, 163 tests, green before (feat commit) and after. Gates: lint exit 0; typecheck exit 0; test 26 files, 163 passed; build exit 0; git status clean after build; openspec valid. Task 3.3 ticked. `grep ImageTile apps/web/src` shows only ui imports and `alt=""` calls.
## Requests
None.
## Blockers
None.
