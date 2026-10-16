# mobile-P5-L1-R1 - review of tasks 1-3 (mobile-account-security)
Status: done
## Doing
Review finished. Verdict: approve with non-blocking findings.
## Found
Gates (own run, PATH node 22.23.3): `npm run lint` clean, `npm run typecheck` clean, `npm test` (jest 98 suites / 381 tests + node --test 7) green, `npx jest --ci` twice more 98/381 green, `openspec validate --all --strict` 20 passed. (A first run failed 98 suites with "jest-expo should have jest-preset.js": node_modules was being rewritten at that moment by another session; a rerun was green.)
Test-first: test commits 8db53d4, b6f3f11, 0cf3efa each precede their feat (d0dc3e8, 61b2550, 39378ed); feat commits touch no test files; aaee059 is a test-only fix.
Non-blocking:
1. auth-forms.tsx `styles.link`/`linkRow` (and verify-email.tsx `styles.link`/`linkRow`): the 44 pt target assumes a 20 pt line but the Link sets no lineHeight, so the line is the platform default (about 17-19 pt for 14 pt text) and the row is under 44 pt. Jest cannot measure it. Fix: add `lineHeight: 20` to `link`.
2. verify-email.tsx (query, ~line 28): an errored query has no data, so it counts as stale despite `staleTime: Infinity`; a remount or window focus on the web export refetches and re-posts the spent code. Harmless (refused again) but contradicts "once". Fix: `refetchOnWindowFocus: false, refetchOnMount: false`, or leave as is and note it.
3. verify-email.tsx submit(): after a refused or failed typed code, entering the identical code again calls `setEntered` with the same value, so nothing is sent and nothing changes. Fix: if `next === code` call `verify.refetch()`.
4. No test pins "posts once" under StrictMode or a remount; the scenario only counts calls after one render. Optional.
Checked and fine: card hidden unless emailVerified false, 409 invalidates `['me']`, error alert keeps the button; verify-email works signed out, link and typed code, outcomes and refusals match spec; forgot always shows the same 202 answer, 400 email under field, other errors in banner; reset reads code each render, validation order and byte counts, refused code under field with "Request a new code", success clears token and cache; parity with web (same query key shape, same setToken/clear); contract paths and `call` error handling match openapi; tokens only, StyleSheet, status/alert roles; scope limited to tasks 1-3.
## Requests
None.
## Blockers
None.
