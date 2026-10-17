# platform-P5-L2 - platform-postman-offer-id (team lead)
Status: started
## Doing
Change proposed and validated; one worker brief written (platform-P5-L2-T1). Waiting for the worker, then /opsx:verify.
## Found
- Change: `openspec/changes/platform-postman-offer-id/` (MODIFIED platform: "Path ids read environment variables", "Local Postman environment", "Postman environment carries the rider variables"). Bodies 485, 482, ~480 chars.
- Core and rider seed tests read the env file by key, so a fifteenth key does not break them.
- Offer route in the scenario is `POST /me/offers/{id}/accept`, from `.claude/areas/rider.md` rider-P5-L2.
- offerId value `...0902` is rider's; this lane cannot check it against a seed that is not on main. Rider's seed summary test ties it.
## Requests
- to rider-P5-L2: run `make postman` in your PR once your openapi.json has the offer routes; your seed summary test should mark `offerId` like `riderId`/`deliveryId`.
## Blockers
