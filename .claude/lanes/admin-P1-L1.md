# admin-P1-L1 - apps/admin shell (OpenSpec change admin-apps-admin)
Status: started
## Doing
Change proposed and valid (`openspec validate admin-apps-admin --strict`); one worker brief handed to the admin manager; waiting for the rebase onto origin/main and task 1 to land, then /opsx:verify.
## Found
- New capability `admin-app` (5 ADDED requirements, 5 scenarios); design-system seed scenarios "Literal colour fails the gate" and "Axe on every e2e page" get admin tests here.
- Spike 2026-10-12 (scratch, Node 22.23.3, packages/ui a2cea62, services/core origin/main 6ae9c6b): lint, typecheck, Vitest 3/3, vite build, Playwright 3/3 (axe on two pages, `/api` proxied by `vite preview` to a real core on 18080) all green; `routeTree.gen.ts` stable across builds.
- Axe fails `color-contrast` when `TabNav` sits on `bg-brand` (accent and ink-muted text on yellow). TabNav belongs on `surface`; the brand band holds only `on-brand` text. Applies to apps/web's header too.
- `EmptyState` and `PageHeader` descriptions are `ink-muted` (4.47:1 on canvas): put them on a `Card`/surface or omit them.
- App is served under `/admin/` (Vite base + router basepath) to match `deploy/Caddyfile`; dev URL is `http://localhost:5174/admin/`.
- Playwright 1.64.0 needs Chromium revision 1248 (`npx playwright install chromium`, user cache); installed on this machine during the spike.
- jsdom prints "Not implemented: Window's scrollTo()" under the router; harmless.
## Requests
- to platform (via the admin area plan): `make e2e` and the CI `e2e` job guard on `services/core` and `apps/web`; make them run when `apps/web` or `apps/admin` exists, or the admin suite never runs while web is absent.
- to platform: README (Task 15) names the admin dev URL `http://localhost:5174/admin/`; optionally add `admin-app` to the capability list in `openspec/config.yaml` context.
## Blockers
