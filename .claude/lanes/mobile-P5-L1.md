# mobile-P5-L1 - mobile-account-security (team lead)
Status: started
## Doing
T1 and T3 launched by the manager (group A); T2 after T1's feat commit, then T4 and T5 with the e2e slot. Acceptance (6.1) after T5. Answering worker questions here.
## Found
- Change `openspec/changes/mobile-account-security/`: proposal, `specs/mobile-app/spec.md` (14 ADDED requirements, 28 scenarios, every requirement under 500 characters), design.md (web requirement mirrored per behaviour, 6 decisions, scenario-to-test map, contract audit, ceilings), tasks.md (5 worker briefs T1 to T5, acceptance 6.1). No `docs/design/mobile-P5-L1.md`: design.md settles every choice and no new artboard exists. `openspec validate --all --strict`: 20 passed.
- Read at start: area plan (Phase 5 package, Found), PLAN.md Phase 5 and D53, core's five routes in `services/core/openapi.json`, `accounts` spec, the archived `web-account-security` change and web lane log, `mobile-app` spec, archived mobile designs (L1, L5b), every in-flight lane file (none touches `apps/mobile`).
- Static export: query params survive a direct load of a static route (probed 2026-10-16: export served on 15199, `/sign-in?returnTo=%2Fcheckout` hydrated with the "Create an account" link at `/register?returnTo=%2Fcheckout`; server stopped by its port's PID, `dist/` removed). `/verify-email` and `/reset-password` become `verify-email.html` and `reset-password.html` once their route files exist. The screens read the code from the URL each render, never copy it into state at mount.
- Playwright starts `webServer` before `globalSetup` (playwright `createGlobalSetupTasks`: plugin setup, then global setups), so global setup can read core after its reseed.
- Deviation from the work package (decision, escalated): verify-email takes the code as a field too (the package named it for reset only); core mails a bare 43-character code and nothing on a phone turns it into `shopperstop://verify-email?token=`. The sent card and the forgot screen each offer "Enter the code".
- Deviation: "profile sheet" in the package read as the "My account" screen (web's `/account`); the Edit profile sheet is only open while editing.
- 2026-10-16 manager confirmed all five decisions as proposed: verify code field, card on "My account", "code" copy, refused reset code under the field with "Request a new code", hygiene last. Manager relays the two core requests (mail link, 429 on `POST /me/email-verification`) to the orchestrator.
- Contract audit: no blocking gap. Core mails no link (bare code); no 429 on `POST /me/email-verification`; no public resend for a signed-out customer.
## Requests
- to mobile manager: T2 after T1's `feat:` commit, T4 after T2 and T3 (e2e slot), T5 after T4 (e2e slot).
## Blockers
None.
