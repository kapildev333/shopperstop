# ui-P3-L2 - rider API types, OpenSpec change ui-rider-api-types
Status: started
## Doing
Change proposed and valid (`openspec validate ui-rider-api-types --strict`); one worker task (ui-P3-L2-T1) briefed to the manager.
## Found
- `openspec/changes/ui-rider-api-types/`: MODIFIED "Generated API types" on `design-system` (five scenarios), one task.
- `gen:api` becomes a one-line `sh` script: core unconditional, then `if test -f ../../services/rider/openapi.json; then ...; else echo "gen:api: services/rider/openapi.json absent, skipping"; fi`. Spiked on 90a6a96: skip path exit 0, present path byte-identical to the CLI's stdout; generated `rider.d.ts` passes eslint and the colour scan.
- `src/api/core.test.ts` is renamed `api.test.ts` (covers both contracts).
- Export added: `"./api/rider": { "types": "./src/api/rider.d.ts" }`, one entry after `"./api"` (ui-P4-L1 also edits `exports`; second to land rebases).
- For the rider area (D19 extended): once this is on main, a rider lane that changes `services/rider/openapi.json` runs `make gen` and commits `packages/ui/src/api/rider.d.ts` in the same PR. If rider-P3-L2 lands first, this branch regenerates `rider.d.ts` after its rebase.
## Requests
- to rider (via the area plan): D19 extended, as above.
## Blockers
