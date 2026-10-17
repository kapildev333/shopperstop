## Context

`scripts/postman.mjs` maps a path id to an environment variable through `ID_VARS` (segment before the parameter → variable name). Rider-P5-L2 needs `offers` → `offerId`, with the value its seed loads.

## Decisions

- One entry in `ID_VARS`, one entry in the environment after `deliveryId` (it is a rider id; rider variables stay together, `serviceToken` stays last). No other code.
- Value `00000000-0000-4000-8000-000000000902` is fixed by rider-P5-L2 (the seed's demo offer); this lane does not verify it against a seed that is not on `main` yet. Rider's seed test closes that loop.

## Risks

- Until rider's offer routes land, `offerId` is unused by any collection. Harmless; the alternative (waiting) blocks rider.
