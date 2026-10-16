# mobile-P5-L1-T1 - verification card on "My account" and checkout (task 1 of mobile-account-security)
Status: done
## Doing
Done: tests b6f3f11 (`test: verification card on the account and checkout`, red 4 of 5 on assertions: "unverified customer sees the card" on the card text, "verification email sent", "already verified when sending" and "sending fails" on the send button; "verified customer sees no card" passed before the feature, as the brief says). aaee059 (`test: await the account unmount in the verification card test`): the unmount was not awaited; RNTL 14's `unmount` is async, and the leftover act broke the next test only once the card rendered in checkout. Red unaffected (the first test fails before the unmount). Feature commit follows: `src/verify-email-card.tsx`, one line in `AccountContent`, the checkout line and `cardPad`.
## Found
- Decision 1 built as written. `VerifyEmailCard` returns nothing until `/me` answers `emailVerified: false`; send is `POST /me/email-verification`, 409 invalidates `['me']`, other failures set the red alert line.
- Existing account and checkout screen tests pass unchanged.
- Gates (worktree, PATH prefix): `npm run build --workspace packages/ui` exit 0; `npm run lint --workspace apps/mobile` exit 0; `npm run typecheck --workspace apps/mobile` exit 0; `npm run test --workspace apps/mobile` exit 0, Test Suites 95 passed, 95 total, Tests 373 passed, 373 total; `npm run build --workspace apps/mobile` exit 0 (Exported: dist; `/forgot-password` and `/reset-password` listed from T3's committed feat); `openspec validate --all --strict` Totals 20 passed, 0 failed.
- Helper note for the manager: `d0dc3e8` (T3's `feat:`) was already on the branch when the full suite ran, so the suite was green with it.
## Requests
none
## Blockers
none
