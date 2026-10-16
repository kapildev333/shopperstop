## Context

`scripts/postman.mjs` converts each `services/<service>/openapi.json` with `openapi-to-postmanv2` (6.4.0, `parametersResolution: 'Example'`) and then post-processes every request in `fixRequest`: bearer token variable by path, id path variables to environment variables, a token-storing script on sign-in. Three gaps, all found by other areas:

1. A parameter with no example (on itself or its schema) and no schema `default` gets a value from the converter's faker: a random integer, date or uuid on every run, in the request and in each saved response's `originalRequest`. Measured: an integer query parameter and a `date-time` query parameter change on every run; a `default` is used as is (rider's `pageSize` 24). `fixRequest` overwrites id path variables in the request only, so a path id without an example is random in `originalRequest`. Both contracts on `main` carry examples, so the committed collections are stable today.
2. Core marks the five routes a service token may call with `x-service-token: true` (core-P3-L1; `TestContractSecurity` in `services/core/internal/app/contract_test.go` proves the mark against the router, both ways). The generator ignores it: those routes read `{{staffToken}}`.
3. `make gen` runs `gen:api` but not `gen:tokens`; `packages/ui/scripts/gen-tokens.mjs` is pure and its output equals the committed `src/tokens.ts` (checked: identical bytes on two runs).

`openspec/config.yaml` lists all 18 capability folders under `openspec/specs/`; nothing to do there.

## Goals / Non-Goals

Goals: the five spec deltas and two added requirements; collections regenerated; `make gen` and `make postman` clean on a second run.

Non-goals: any edit under `services/`, `packages/`, `apps/`; a second "as staff" request per service route; a `serviceToken` sign-in script (there is no sign-in for services); CLAUDE.md's `make gen` row (outside this lane's scope, reported to the manager).

## Decisions

### 1. Fill missing examples before conversion

`generate()` already converts `structuredClone(spec)`. Before converting, fill each parameter of the clone that has none of `example`, `examples`, `schema.example`, `schema.examples`:

```js
// ponytail: a filled value is deterministic, not valid; a contract that wants a runnable request gives an example.
function fillExamples(spec) {
  const lists = [
    Object.values(spec.components?.parameters ?? {}),
    ...Object.values(spec.paths ?? {}).flatMap((item) => [item.parameters ?? [], ...Object.values(item).map((op) => op?.parameters ?? [])]),
  ];
  for (const p of lists.flat()) {
    if (p.$ref || 'example' in p || p.examples || p.schema?.example !== undefined || p.schema?.examples) continue;
    p.example = p.schema?.default ?? p.schema?.enum?.[0] ?? `<${p.name}>`;
  }
}
```

Called as `const data = structuredClone(spec); fillExamples(data);` and `data` is what `convertV2` receives. The caller's object is never changed. Walking only `components.parameters`, path-level and operation-level `parameters` (not a deep walk) keeps response examples that happen to look like a parameter untouched. `<name>` follows the converter's own `<string>`-style placeholders.

Rejected: rewriting `originalRequest` alone (the orchestrator's first framing). It fixes path ids in saved responses, but a non-id parameter without an example is random in the request too (measured), so it does not make the collection deterministic on its own.

### 2. Id rewrite also on saved responses

`fixRequest` runs its id loop over the request URL and every `item.response[].originalRequest.url`:

```js
for (const u of [url, ...item.response.map((r) => r.originalRequest?.url).filter(Boolean)]) {
  for (const v of u.variable ?? []) { /* the existing ID_VARS rule, unchanged */ }
}
```

Saved examples then name the same environment ids as the request. `originalRequest` keeps the converter's literal `Authorization: Bearer <token>` header (deterministic, not rewritten).

### 3. `x-service-token` selects `{{serviceToken}}`

`generate()` builds the set of service operations from the contract and passes it down `walk` to `fixRequest`:

```js
const serviceOps = new Set(Object.entries(spec.paths ?? {}).flatMap(([path, item]) =>
  Object.entries(item).filter(([, op]) => op?.['x-service-token'] === true)
    .map(([method]) => `${method.toUpperCase()} ${path.slice(1).replace(/{([^}]+)}/g, ':$1')}`)));
```

In `fixRequest`: `const token = serviceOps.has(`${item.request.method} ${url.path.join('/')}`) ? 'serviceToken' : tokenVar(url.path, svc);` and the bearer reads `{{${token}}}`. The sign-in script keeps `tokenVar` (no service route signs in). The converter's `url.path` has no server prefix and writes `{id}` as `:id` (both collections today), so the key matches.

No contract change and no list in the generator: the extension is already on `main` and core's contract test keeps it honest.

### 4. `serviceToken` in the environment

Appended as the twelfth variable, after `deliveryId` (no index of an existing key moves; core's and rider's seed tests read the file by key):

```json
{ "key": "serviceToken", "value": "dev-rider-service-token-dev-rider-00", "type": "secret", "enabled": true }
```

The value is the Makefile's `SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN ?=` default, which `SHOPPERSTOP_CORE_SERVICE_TOKENS ?= rider:$(...)` hands to core under `make dev`. The other tokens are empty because a sign-in request fills them; nothing fills this one, and the dev value is already public in the `Makefile`, so shipping it keeps the collection runnable against `make dev` (D20's intent). A test ties it to the Makefile line.

### 5. `make gen` runs `gen:tokens`

The `packages/ui` line becomes:

```make
	@if test -d packages/ui; then npm run gen:api --workspace packages/ui --if-present && npm run gen:tokens --workspace packages/ui --if-present; \
	else echo "gen: packages/ui absent, skipping"; fi
```

One line, same guard, `--if-present` like `gen:api`. CI's `make gen postman` clean-tree check then covers `src/tokens.ts`.

### 6. README

Three edits, exact text:

- `make gen` row, appended before the final period: `, then `packages/ui/src/tokens.ts` from `tokens.css``. The row ends `... once the rider contract exists, then `packages/ui/src/tokens.ts` from `tokens.css`.`
- `## API` paragraph, one sentence appended: ``The environment's `serviceToken` holds the Makefile's dev service token; the requests for the routes `openapi.json` marks `x-service-token` (the ones the rider service calls) read it instead of `staffToken`.``
- A new section between `## Commands` (after its "Each target prints" line) and `## API`:

```markdown
## Troubleshooting

**`npm install` crashes with `Cannot read properties of null (reading 'edgesOut')`.** npm 10.9.9 hits this on an `npm install` that adds a new workspace: the fresh resolution of `vitest` 5.0.4 in the new workspace trips over its optional peer `@vitest/browser-playwright`. `npm install --legacy-peer-deps` and npm 11 get past it but rewrite other workspaces' lock entries. The rider app (Phase 3) was added this way instead: its entries in `package-lock.json` were seeded from `apps/admin`, which has the same dependencies (each `apps/admin/node_modules/*` entry copied as `apps/rider/node_modules/*`, the `apps/admin` entry copied as `apps/rider`, and the `node_modules/@shopperstop/rider` link added), then npm 10's `npm install --package-lock-only` validated the lock and `npm ci --dry-run` accepted it. `npm ci` from the committed lock, as in the Quick start and in CI, does not hit the crash.
```

Every statement is from `.claude/lanes/rider-P3-L3-T1.md` and `.claude/areas/rider.md` Requests.

## Simplifications and ceilings

- One request per operation, so the five service routes now read `{{serviceToken}}` and a staff user replays them by switching the auth to `{{staffToken}}` by hand. Ceiling: `POST /admin/orders/{id}/status` carries the converter's first body example, core's `staff` example (`{"status":"accepted",...}`); with the service token core answers it 400 (`actor` required). Fix is core's (put the `rider` example first); requested in the lane report, the generator needs no change.
- A filled `<name>` makes a request deterministic, not runnable. Ceiling: a contract without examples yields requests a user edits before sending; both contracts on `main` carry examples.
- `fillExamples` reads only `components.parameters` and the path and operation `parameters` arrays. Ceiling: a parameter reached any other way (a `$ref` to another file) is not filled; neither contract does that.
- `serviceToken` ships the dev value. Ceiling: any non-dev core needs the value replaced in Postman; the same holds for `baseUrl`.
- The README and Makefile scenarios are checked by `check-tooling.sh` (greps, `make -n`, one real `make gen`), not by a framework, like the archived platform changes.

## Files

All in platform: `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/local.postman_environment.json`, `docs/postman/shopperstop-core.postman_collection.json`, `docs/postman/shopperstop-rider.postman_collection.json`, `Makefile`, `README.md`, `openspec/changes/platform-postman-tooling/`.

## Test strategy

- Task 1, `node --test scripts/postman.test.mjs` (also run by `make postman`). New and changed tests, all red before the generator and environment change:
  - `service routes read serviceToken`: `fixture` gains `GET /admin/stores` (summary `Stores`, tag `admin-staff`, `security: [{bearer: []}]`, `'x-service-token': true`, a 200 example `{"items":[],"total":0}`); `Stores` reads `{{serviceToken}}`, `Me` still `{{staffToken}}`.
  - `core service routes follow x-service-token`: on `realSpec`, the set of `METHOD path` (path as `/` + `url.path.join('/')` with `:x` turned back to `{x}`) of requests reading `{{serviceToken}}` equals the set the contract marks `x-service-token: true`, and that set is not empty.
  - `saved responses read environment ids`: on `fixture`, every `response[].originalRequest.url.variable` of `Order` is `[['id', '{{orderId}}']]`.
  - `parameters without an example get a fixed value`: a new `paramFixture` (`GET /things/{code}`, summary `Thing`, path `code` string, query `since` string `date-time`, query `pageSize` integer `default: 24`, query `status` string `enum: ['ready', 'delivered']`, none with an example, a 200 example `{"code":"x"}`); two `generate(paramFixture)` calls give identical text; the request and each `originalRequest` have `code` `<code>`, `since` `<since>`, `pageSize` `24`, `status` `ready`; `paramFixture`'s parameters still have no `example` afterwards.
  - `environment holds the twelve variables`: the existing eleven-variable test renamed, `serviceToken` appended to the key list, `serviceToken` added to the `secret` type loop (not the empty loop).
  - `serviceToken is the Makefile dev service token`: reads `../Makefile`, matches `/^SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN \?= (\S+)$/m`, asserts the environment's last key is `serviceToken` and its value equals the match.
  - Existing `committed collection matches the contract` and `rider collection follows the rider contract` go green only with the regenerated collections.
- Task 2, `sh openspec/changes/platform-postman-tooling/check-tooling.sh` (committed with this proposal): red today on the docs and make sections, green after the edits.
