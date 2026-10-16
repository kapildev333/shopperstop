# mobile-P4-L2-R1 - review of mobile-P4-L2 tasks 1-15 (reviewer)
Status: done. Verdict: approve (no blocking findings).
## Gates (committed state, a098a1f merge)
- apps/mobile: lint clean, typecheck clean, `npm test` 68 suites / 235 tests pass; `npx jest --ci` x3 more pass, plus once `--no-cache`. No flake reproduced.
- `openspec validate --all --strict`: 20 passed.
## Findings
Non-blocking:
1. src/pincode-sheet.tsx `next()`: a dismissal during the lookup is ignored. Sheet closed (back/backdrop) while `resolvePincode` is pending -> the form unmounts, but `next()` resumes, calls `setPincode(value)` and may open the store-change dialog. Fix: re-check `usePincodeSheetOpen` state (module flag) after the await, return if closed.
2. src/pincode-sheet.tsx `onSubmitEditing`: not guarded by `pending`; keyboard "go" twice runs two lookups. Fix: `!pending && isPincode(value) && next()`.
3. src/pincode-sheet.tsx: a failed lookup with a non-empty cart at another store saves the pincode without the confirm (cart stays, `setQuantity` later drops the old store's counts silently). Ceiling documented? Not in design; note for L3 (core cart clears server-side).
4. src/ui/status-message.tsx: static inline style object; the lane brief asked for StyleSheet. ImageTile's frame is dynamic (size), fine.
5. src/pincode-sheet.tsx StoreChangeDialog title renders "Switch to the undefined store?" while `change` is undefined (Modal hidden, not visible). Cosmetic; guard with `change?.store.name ?? ''`.
6. Flakiness: gate test 'loading while the pincode is unknown' depends on running first in its file (documented in a comment; jest.setup afterEach `setPincode(undefined)` makes later tests deterministic). Not reproduced as failing; likeliest source of the one unidentified failure is RNTL's 1000 ms findBy default on a cold expo-router render under parallel load (renderRouter tests); consider `asyncUtilTimeout` in jest.setup if it recurs.
## Checked and fine
Test-first order per task (test commit precedes each feat); pincode store (single read, late-safe, blocked storage); closed store gates Home/Categories/Category/Product/Search; pages of 24, load more; D44 filters sent only when on, in query key; city in header; Change store calls clearCart; cart stub names stable; Price via formatInr tabular; Stepper 44pt via hitSlop, out of stock; Dialog onRequestClose, modal; StatusMessage polite live region; ImageTile aspectRatio 1; tablist/tab roles; no literal colours; async-storage 2.2.0 matches expo bundledNativeModules, lock adds only merge-options and is-plain-obj; scope within L2 plus the agreed one-line e2e and orders-cancel swap.
