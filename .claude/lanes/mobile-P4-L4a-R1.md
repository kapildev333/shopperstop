# mobile-P4-L4a-R1 - review of lane/mobile-P4-L4a-orders
Status: done. Verdict: approve.
## Gates (Node 22.23.3)
- apps/mobile lint, typecheck exit 0; jest 41 suites, 154 tests passed (plus scripts tests 7/7); build exit 0 after the manager's `npm ci` (first failure was the missing expo-splash-screen module, not a finding); `openspec validate --all --strict` 20 passed. make e2e not run (manager).
## Checked
- Test-first order holds for every feat/fix (tests precede orders.ts, rider.ts, history, RiderCard, cancel dialog, tracking, error unwrap, landmark, rider-card margin). 0a275d6 holds only orders-cancel.tsx, its lane log and tasks.md.
- Polling 10 s until terminal (orders.ts pollInterval); rider read 10 s only while out_for_delivery, once when delivered; 404 is null for both.
- Cancel: body {} without reason matches OrderCancel (reason optional, max 500, chips fixed); Keep order first; ref guard; 409 refetches and shows message.
- Rider card only in out_for_delivery/delivered with a name; Maps link only with a location. Contracts match both openapi files. No literal colours.
## Findings (non-blocking)
1. apps/mobile/src/rider.ts:46 throws the whole envelope (`error`) while orders.ts unwraps `error.error`; nothing reads it today (RiderCard ignores errors) but a future ErrorBanner would get the wrong shape. Fix: `throw error.error ?? new Error(...)`.
2. apps/mobile/src/app/(tabs)/orders.tsx OrderCard: accessibilityLabel "View order N" replaces the content, so status, total and time are not announced. Fix: include them in the label.
3. apps/mobile/src/orders-cancel.tsx:44: Keep order stays pressable while a cancel is in flight; the later close() is harmless, but disable it while busy for clarity.
4. apps/mobile/src/orders-cancel.tsx:9 comment says Dialog is not on the branch; keep until src/ui/dialog.tsx exists (still absent after the merge).
