# mobile-P4-L1-R1 - review of tasks 1 to 14 of mobile-foundation-accounts (head 6d563f5)
Status: done
## Doing
Review finished. Verdict: APPROVE (no blocking findings). T15 (e2e) and acceptance 16 are out of this review.
## Found
Gates run by the reviewer in the worktree (Node 22.23.3):
- `npm run build --workspace packages/ui`: ok
- apps/mobile `npm run lint`: clean; `npm run typecheck`: clean
- apps/mobile `npm test`: 22 suites, 82 tests passed
- apps/mobile `npm run build`: exported; dist holds index, categories, orders, sign-in, register, account, +not-found html
- `openspec validate --all --strict`: 19 passed, 0 failed
- `git status` clean afterwards. e2e not run (Postgres down, T15 pending).

Coverage: every scenario in specs/mobile-app/spec.md for tasks 1 to 14 has a named test (the two gate scenarios, Root test arguments ignored and Web export built, are covered by the gates above; all pass). The e2e scenarios exist as written specs only.
Test-first: each `feat:` is preceded by its `test:` commit (scaffold 0a2b9ca/43fad45, session+client 701ed43/2bce9f1, Text 29b1daf/1d5088e, Button 5907cda/4578f43, FormField fdc238c/d3ea5bb, marks eb270e8/9b9ae40, states 6c3be34/8c4e9e3, auth e416b4c/a0ab7b7, Sheet dfc4374/2cbe9a3, shell 94cdbf9/a314757, forms 39515b7/46b6d84, profile 38e587a/5a3b942, address adb004e/5b9d8d4, account b52da14/159c4ac, e2e 915840c/8ea2fff). Not re-checked by checking out each test commit.
Scope: only apps/mobile, the change dir, docs/design/mobile-P4-L1.md, lane logs and package-lock.json. The lock diff changes no resolved version of any pre-existing package (compared all node_modules entries: 0 changed), only adds the new tree and re-nests.

Findings (all non-blocking):
1. apps/mobile/src/ui/sheet.tsx:30-37 (and address-sheet.tsx:60-132): sheet children are not in a ScrollView. The address form (chips, three fields, switch, alert, button, roughly 600 px) plus the keyboard on a small phone (iPhone SE class) will push the title and first fields off screen with no way to scroll. Smallest fix: wrap `children` in a `ScrollView keyboardShouldPersistTaps="handled"` with a `maxHeight` of about 90% of the window.
2. apps/mobile/src/app/account.tsx:140-163: Set as default and Delete have no in-flight guard. A double tap sends two DELETEs; the second 404 shows an error line over a successful delete. Delete is also immediate with no confirmation (the spec asks for none). Smallest fix: disable the row buttons while a row action is pending.
3. apps/mobile/src/auth-forms.tsx:94-132 (and the register form): no `onSubmitEditing` on the last field, so on the web export Enter in Password does not submit. Keyboard users must tab to the button. Smallest fix: `onSubmitEditing={submit}` on Password (and `returnKeyType="go"`).
4. apps/mobile/src/app/account.tsx:3 and :27 / address-sheet.tsx:3: `useBack` and `splitError` live in `auth-forms.tsx` and are imported by account and the address sheet, an odd dependency direction. Move both to a small shared file when next touched.
5. apps/mobile/src/ui/error-banner.tsx:36-52 and ui/chip.tsx, ui/skeleton.tsx, app/(tabs)/index.tsx: inline style objects and raw numbers (8, 10, 12, 16, 22, 64) instead of `StyleSheet.create` and `spacing`; ErrorBanner's "Try again" re-implements the primary Button recipe instead of using `Button` (CLAUDE.md: never a one-off recipe). Behaviour is right (44 px, tokens only). Reuse `Button` in ErrorBanner.
6. apps/mobile/src/ui/sheet.test.tsx: Escape on the web export is in the spec text but only `onRequestClose` is tested; fine for jest, make sure the e2e run (T15) or the manager walk presses Escape on an open sheet.
7. apps/mobile/src/app/account.tsx:23-27 with session.ts:56 (server snapshot `undefined`): the static export renders `/account` as the redirect, the client with a stored token renders the content, so hydration can mismatch on a reload of /account when signed in. Expo recovers by client render, but watch the console and axe in the T15 reload scenario ("Addresses against core", after reload).
8. apps/mobile/jest.config.js:6 hard-codes `<rootDir>/../../node_modules/lucide-react-native/...`; breaks if npm stops hoisting it. Prefer `require.resolve('lucide-react-native/dist/cjs/lucide-react-native.js')`. Also package.json lists `@expo/metro-runtime` out of alphabetical order (cosmetic).
9. The split tests (account-home, account-sign-in, account-sign-out, account-redirect, auth-forms-*-home) exist because expo-router keeps module-level navigation state; the file names do not say so apart from comments in each file. Acceptable, noted so a later lane does not merge them.
10. apps/mobile/src/auth-forms.tsx:75 copy "Your cart stays as it is." on sign-in: no cart exists in the mobile app yet (L2+). Harmless, check it with the design canvas copy.
Correct and worth keeping: 401 handling only for the current token (api.ts:25-30), non-envelope failures normalised to `internal`, safeReturnTo (auth.ts:8) rejects `//`, `/\` and arrays, token storage guarded by try/catch, email trimmed, password length in bytes, no literal colours (scanner plus quoted-name scan), 44 px targets on Button, IconButton, Chip, switch row.
## Requests
- to mobile-P4-L1 (worker/team lead via manager): findings 1 to 3 are cheap and worth doing before or inside T15; 4 to 10 can wait.
## Blockers
None. Other lane files read at start: mobile-P4-L1 and T1 to T14 (not modified).
