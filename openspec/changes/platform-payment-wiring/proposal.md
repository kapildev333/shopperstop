## Why

Phase 5 adds the payment service (PLAN.md D48 to D53): `services/payment`, a Go module with its own database, port 8082 (e2e 18082), routes `/api/payment/v1`, env prefix `SHOPPERSTOP_PAYMENT_`, no app. The payment area cannot start until its local wiring is on `main`: the role and databases, the Makefile targets and env for dev, test and e2e (including the `fake` gateway, D49), the Caddy route, a CI job, the Postman collection and environment variables, the docs and the area lists. Every piece must skip while `services/payment` is absent and leave today's targets doing what they do now.

## What Changes

- `deploy/initdb.sql`: role `shopperstop_payment` and databases `shopperstop_payment`, `_test`, `_e2e` owned by it. The running `shopperstop-postgres-1` gets them by hand (D33, the orchestrator); README gives existing clones a one-line command.
- `deploy/Caddyfile`: `/api/payment/*` to `host.docker.internal:8082`. No static route (no app), no compose change (the `../apps` mount already covers every app).
- `Makefile`: payment defaults (`SHOPPERSTOP_PAYMENT_DATABASE_URL`, `_ADDR`, `_SESSION_PEPPER`, `_WEB_ORIGINS`, `_CORE_URL`, `_CORE_SERVICE_TOKEN`, `_GATEWAY=fake`, `_PUBLIC_URL`, `_TEST_DATABASE_URL`) as `PAYMENT_ENV`; `SHOPPERSTOP_CORE_SERVICE_TOKENS` becomes `rider:<rider token>,payment:<payment token>`; targets `payment` and `test-payment`; `seed`, `dev` (`-j6`), `test`, `e2e`, `gen` (payment sqlc) and `prod-local` (`-j3`) include payment. `E2E_ENV` gains fixed payment values (`shopperstop_payment_e2e`, `:18082`, core `http://localhost:18080`, `fake`, public URL `http://localhost:18082`, origins 15173 to 15176, an e2e token in core's e2e list). Each new step prints one skip line while `services/payment` is absent.
- `scripts/postman.mjs`: `payment` joins the service table (`paymentBaseUrl`; its `/me` routes read `customerToken`, since customers sign in through core) and `payments` joins the id table (`paymentId`). `docs/postman/local.postman_environment.json` gains `paymentBaseUrl` and `paymentId` before `serviceToken`. Core and rider collections stay byte-identical.
- `.github/workflows/ci.yml`: a `payment` job, the rider job's twin, guarded by `hashFiles('services/payment/go.mod')`. The `core` job's `make gen postman` clean-tree check already regenerates the payment files once they exist.
- `README.md`, `CLAUDE.md`: payment URL, targets, fake gateway, the D33 one-liner for payment, the sixth CI job, layout and area lines.
- `.claude/commands/orchestrate.md`, `.claude/commands/manage.md`, `openspec/config.yaml`: area `payment` (`services/payment/`); config lists the Phase 5 capabilities `payment-service` and `payment-gateway-razorpay`.

## Capabilities

### New Capabilities

None. `payment-service` and `payment-gateway-razorpay` are seeded by the payment area's own changes (PLAN.md Phase 5).

### Modified Capabilities

- `platform`: MODIFIED "One database and owner role per service", "Caddy routes each prefix to its service or app", "Postman collection is generated from the contract", "Postman skips a service without a contract", "Postman requests authenticate from environment tokens", "Path ids read environment variables", "Local Postman environment", "Repository documentation matches the tree", "CLAUDE.md and docs/figma.md describe the tree", "make dev runs the rider service and app", "Dev origins include the mobile web export", "make e2e gives the rider an isolated environment", "make gen runs the rider sqlc", "CI runs a rider job" (each made true again with a payment service beside the rider). ADDED the payment requirements for the Makefile, CI, the Postman environment and the area lists.

## Impact

- Area: platform. Files: `deploy/initdb.sql`, `deploy/Caddyfile`, `Makefile`, `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/local.postman_environment.json`, `.github/workflows/ci.yml`, `README.md`, `CLAUDE.md`, `.claude/commands/orchestrate.md`, `.claude/commands/manage.md`, `openspec/config.yaml`, and this change folder (including `check-payment-wiring.sh`).
- Cross-area contracts relied on, none existing yet: `services/payment/openapi.json` (payment: `servers` `/api/payment/v1`, bearer `security` on customer routes, no `/auth` routes), `services/payment/cmd/payment`, `cmd/payment-admin migrate` and `seed-demo --reset` without a running core, the env names above read by payment's config (payment-P5-L1), the `gen:api` script of `packages/ui` generating `payment.d.ts` (ui-P5-L1), core's `SHOPPERSTOP_CORE_SERVICE_TOKENS` parser accepting two entries (already true on `main`) and the `payment` service subject's routes (core-P5-L1), the web, mobile and admin Playwright configs starting the payment service on :18082 (their Phase 5 lanes).
- Out of scope: the payment service and its tests; `packages/ui` `gen:api` and `payment.d.ts`; a committed payment collection (the first payment PR with `openapi.json` runs `make postman` and commits it); Razorpay keys (owner's, never in the repository, D49); `deploy/docker-compose.yml`; `.claude/areas/*` and `PLAN.md` (orchestrator); the receipt service (Phase 6).
