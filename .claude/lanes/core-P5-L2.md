# core-P5-L2 - store location (OpenSpec change core-store-location)
Status: started
## Doing
2026-10-16: change `core-store-location` written and validated (`--strict`, `--all --strict` 20 passed); one worker brief `core-P5-L2-t1.md`. Waiting for the worker; acceptance (opsx:verify) after it lands.
## Found
- Change `openspec/changes/core-store-location/`: deltas `serviceability` (MODIFIED "Public store view"), `admin-stores` (MODIFIED list/read, create, demo stores; ADDED "Store locations"). design.md carries the whole change as two verbatim diffs (test, feat incl. migration 0012) plus one `openapi.json` script; spiked in this worktree at 150d5e5 and reverted (all 15 core packages green under -race, five new or edited tests red first, `make gen postman` clean, extracted blocks `git apply --check` clean and `go vet` clean).
- Decision: `"location": null` is 400 `validation` field `location` on create and change (already `httpx.ReadPatch`'s answer); a location can be replaced, never cleared. `"lat": null` inside the object answers field `location` (missing). A non-number coordinate is the generic 400 "invalid JSON" without a field, as for every other member.
- `location` is optional in every schema (`StoreLocation` by `$ref`, never `required`, no `default`), so web, rider app, mobile and `packages/ui` typecheck unchanged (spiked).
- For rider-P5-L2: the rider service reads core's store through `GET /stores/{id}` (`services/rider/internal/core/core.go` `Client.Store`), not `GET /admin/stores/{id}`; both carry `location {lat, lng}` (numbers, degrees), omitted when the store has none. Demo stores: Koramangala `...0401` 12.9352, 77.6245; Indiranagar `...0402` 12.9719, 77.6412.
## Requests
- to admin (through the core area plan and the orchestrator, before this change merges): `apps/admin/src/store-form.tsx` line 10: `type Field = keyof StoreCreate` -> `type Field = Exclude<keyof StoreCreate, 'location'>`. Spiked: typechecks against main's and the new `core.d.ts`, lint clean, `store-form.test.tsx` 10/10 green both ways. admin-P5-L2 replaces it when it adds the inputs.
- to rider-P5-L2 (information): add `Location *struct{ Lat, Lng float64 }` (json `location`, `lat`, `lng`) to `services/rider/internal/core.Store`; a nil location means the store dispatches nothing.
## Blockers
None.
