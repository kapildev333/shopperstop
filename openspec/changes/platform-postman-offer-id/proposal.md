## Why

The rider area's `rider-dispatch` change (rider-P5-L2, PLAN.md D57) adds offer routes such as `POST /api/rider/v1/me/offers/{id}/accept` and a fixed seed offer `00000000-0000-4000-8000-000000000902`. For its Postman requests to run against `make dev` without editing ids, the generator must map the `offers` segment to an environment variable and the local environment must hold it.

## What Changes

- `scripts/postman.mjs`: `offers: 'offerId'` joins `ID_VARS`.
- `docs/postman/local.postman_environment.json`: `offerId` = `00000000-0000-4000-8000-000000000902` (type `default`) right after `deliveryId`; `serviceToken` stays last. Fifteen variables.
- `scripts/postman.test.mjs`: the environment test expects fifteen keys and the offer id; a new test checks a path id after `offers` reads `{{offerId}}`.
- No committed collection changes: no contract has an `offers` route yet, so core, rider and payment collections stay byte-identical.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform`: MODIFIED "Path ids read environment variables" (`offers` → `{{offerId}}`), "Local Postman environment" (fifteen keys, five rider variables), "Postman environment carries the rider variables" (`offerId` and its value).

## Impact

- Area: platform. Files: `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/local.postman_environment.json`, this change folder.
- Cross-area contract relied on: rider's seed loads offer `00000000-0000-4000-8000-000000000902` and rider-P5-L2 adds a test tying `offerId` to it (rider's own change). Core and rider seed tests read the environment file by key, so an added key does not break them.
- Out of scope: rider's offer routes, its seed and `openapi.json`; regenerating the rider collection (rider's PR does that with `make postman` once its contract has the routes).
