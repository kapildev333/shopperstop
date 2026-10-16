# mobile-P4-L1-R2 - review of 960cd19..2bf3a46 (task 15, fixes for R1 1-4 and 6, e2e failures)
Status: done
## Doing
Review finished. Verdict: APPROVE (no blocking findings).
## Found
Gates run by the reviewer in the worktree: apps/mobile lint clean, typecheck clean, jest 25 suites / 91 tests passed, build exported, `openspec validate --all --strict` 19 passed 0 failed, git status clean. make e2e not run (manager's).
Scope: only apps/mobile, tasks.md ticks, the T15 log. Colours from tokens only (toggle thumb radius 10 and sizes are plain numbers, no colours).
Test-first: each fix has its test: commit first; e2e-only reds (title, sign out, Escape, aria-checked) recorded in the T15 log; documented why jest cannot observe aria-checked. Accepted.
R1 findings 1 (sheet ScrollView, 80%), 2 (busy guard), 3 (Enter submits), 4 (screen-support), 6 (Escape e2e step) are addressed.
Non-blocking:
1. apps/mobile/src/ui/toggle.tsx:7-18: on the web export react-native-web only turns Space into a press for role button/menuitem (PressResponder isValidKeyPress), so a keyboard user can flip the switch with Enter but not Space; ARIA APG says Space toggles a switch. Smallest fix: handle onKeyDown ' ' on web, or accept and note.
2. apps/mobile/src/app/account.tsx:113-119: rowAction does not reset busy in a finally; if a request ever throws (not normalised to ApiError), all row buttons stay disabled. Use try/finally. Also busy is state, so two presses inside one render tick can still both fire; the test passes because RNTL flushes between presses. A useRef flag would close it.
3. apps/mobile/src/app/account.tsx:24-31: `leaving` is never reset. Fine while router.replace unmounts the screen; if the replace is ever a no-op the screen stays blank after sign out. Acceptable.
4. Title is set per screen with Head only after hydration (static HTML carries the generic "ShopperStop", because the root layout returns null until fonts load). Fine for axe; noted for SEO/share previews, which a customer app may not need.
5. apps/mobile/src/ui/toggle.tsx:34-38 uses raw numbers (44, 26, 3, 20, 10) instead of spacing/radius tokens; the thumb borderRadius 10 could be radius.pill. Cosmetic.
6. Carry-over R1 5, 7, 8, 10 not touched (not required). Re-check 7 (hydration mismatch of /account) in the manager walk; the e2e passes per the T15 log.
## Requests
None.
## Blockers
None. Other lane files read: R1, T15, mobile-P4-L1 (not modified).
