## Context

See proposal.md for why. Inputs: `services/core/openapi.json` (OpenAPI 3.1, `servers[0].url` `/api/core/v1`, today only `GET /healthz` and `GET /readyz` under tag `platform`, no `securitySchemes`). Root `package.json` already has `"postman": "node scripts/postman.mjs"` and `openapi-to-postmanv2@6.4.0` (exact pin, in `package-lock.json`); `make postman` runs `npm run postman` once `scripts/postman.mjs` exists; the CI `core` job runs `make gen postman` and fails on any `git status --porcelain` output (PLAN.md D14). Node floor 22.12 (D11); on this machine use `PATH=~/.local/node-v22.23.3/bin:$PATH`.

Converter facts, observed with 6.4.0 on this contract and a Phase 2 shaped fixture (prototyped by the team lead, not committed):

- `convertV2({type: 'json', data}, {folderStrategy: 'Tags', parametersResolution: 'Example'}, cb)` gives one folder per tag in the contract's tag order, requests named by `summary`, URL `{{baseUrl}}/<path>` with `{id}` turned into `:id` plus a `url.variable` entry, the request body example as `body.raw`, and saved responses whose `body` is the example as a JSON string.
- An operation with bearer `security` gets `request.auth = {type: 'bearer', bearer: [{key: 'token', value: '{{bearerToken}}'}]}`; one without gets `auth: null` (Postman "No Auth").
- Volatile output: a random `id` on every item and response and `info._postman_id`. Everything else is the same on every run. It also emits a collection `variable` `baseUrl` = `/api/core/v1`, which is useless (relative) and would only confuse the environment.
- An invalid document (no `openapi` field) yields `result: false` with a `reason`.

## Goals / Non-Goals

**Goals:** every requirement in `specs/platform/spec.md`; Phase 2 routes (`/auth/*`, `/admin/*`, ids) land with no edit to the script; output byte-stable so CI's clean-tree check never flaps.

**Non-Goals:** capturing `storeId`, `productId`, `addressId`, `orderId` from responses; Newman; collections for later services; wiring the test into `make test` or CI.

## Decisions

1. **One script, one post-processing pass over the converter output.** No templates, no second library. Alternatives: hand-building the collection from the OpenAPI document (more code, re-implements the converter) or a Postman SDK (new dependency, not allowed).
2. **Determinism by deletion, not sorting.** Delete every `id` and `_postman_id` key recursively (bodies are strings, so example data is never touched), delete the collection `variable`, write `JSON.stringify(c, null, 2) + '\n'`. Keys are not sorted: the converter's insertion order is fixed for a pinned version. Ceiling: a converter upgrade may reorder keys or add volatile fields; the PR that bumps it regenerates the file and the determinism test catches new volatile fields.
3. **Which requests carry auth comes from the contract's `security`, the audience from the path.** Bearer auth emitted by the converter is rewritten to `{{staffToken}}` when the first path segment is `admin`, else `{{customerToken}}`. The brief suggested choosing by tag (`accounts` vs `admin-*`); the path is the stronger signal because Spec 2 puts every staff route, including `POST /admin/auth/sign-in`, under `/admin/`, while tag names for Phase 2 are not fixed yet. Consequence for core: Phase 2 must declare `components.securitySchemes.bearer` (`type: http`, `scheme: bearer`) and `security: [{bearer: []}]` on every authenticated operation, otherwise those requests get no auth (request to core, see the lane report).
4. **Sign-in script by shape, not by name.** A request gets `pm.environment.set('<customerToken|staffToken>', pm.response.json().token);` as its `test` event when its path has an `auth` segment and one of its 2xx saved responses parses to an object with a string `token`. This covers customer sign-in, staff sign-in and register (if it returns a token), and skips sign-out. Ceiling: a token-returning route outside `/auth/` gets no script; none exists in Spec 2.
5. **Id path variables by the preceding segment.** A fixed map `stores → storeId`, `products → productId`, `addresses → addressId`, `orders → orderId` keyed on the segment before `:<param>`, whatever the parameter is called. Ceiling: categories, staff and cart lines keep the contract example; extend the map when a run needs them. The ids themselves are set by hand in the environment (or from fixed demo-data ids if core's seed uses them); see Risks.
6. **Environment is a static, hand-written file.** Postman v2.1 environment shape, no `id` (Postman assigns one on import), tokens typed `secret`. Later services reuse it and append their own `baseUrl`-style variables.
7. **Paths resolve from `import.meta.url`**, so `node scripts/postman.mjs` works from any directory; the script runs its main block only when it is the entry point and exports `generate(spec)` for the test.
8. **Test with `node:test` and `node:assert/strict`, run by hand.** `node --test scripts/postman.test.mjs`. No new dependency, no workspace. Not wired into `make test` or CI (the root `package.json` and the CI `web` job are outside this change); CI's gate is `make postman` plus the clean tree. Ceiling: the fixture-only behaviours (auth rewrite, sign-in script, id variables) are not exercised by CI until Phase 2 routes appear in the real contract, at which point the clean-tree check covers them as committed output. Upgrade: add `node --test scripts/` to `make test` in a later platform change if scripts grow.
9. **One input, one output, hard-coded.** Ceiling: when the rider service lands, the script gains a list of `[openapi.json, collection]` pairs.

### The generator (`scripts/postman.mjs`), prototyped and verified

```js
// Generates the Postman collection from services/core/openapi.json (Spec 1 §11).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import converter from 'openapi-to-postmanv2';

const ID_VARS = { stores: 'storeId', products: 'productId', addresses: 'addressId', orders: 'orderId' };

function tokenVar(path) {
  return path[0] === 'admin' ? 'staffToken' : 'customerToken';
}

function returnsToken(item) {
  return item.response.some((r) => {
    if (r.code < 200 || r.code > 299) return false;
    try { return typeof JSON.parse(r.body).token === 'string'; } catch { return false; }
  });
}

function stripIds(node) {
  if (Array.isArray(node)) node.forEach(stripIds);
  else if (node && typeof node === 'object') {
    delete node.id;
    delete node._postman_id;
    Object.values(node).forEach(stripIds);
  }
}

function fixRequest(item) {
  const { url, auth } = item.request;
  if (auth?.type === 'bearer') auth.bearer = [{ key: 'token', value: `{{${tokenVar(url.path)}}}`, type: 'string' }];
  for (const v of url.variable) {
    const name = ID_VARS[url.path[url.path.indexOf(`:${v.key}`) - 1]];
    if (name) v.value = `{{${name}}}`;
  }
  if (url.path.includes('auth') && returnsToken(item)) {
    item.event.push({
      listen: 'test',
      script: { type: 'text/javascript', exec: [`pm.environment.set('${tokenVar(url.path)}', pm.response.json().token);`] },
    });
  }
}

function walk(items) {
  for (const item of items) (item.item ? walk(item.item) : fixRequest(item));
}

export async function generate(spec) {
  const result = await new Promise((resolve, reject) =>
    converter.convertV2(
      { type: 'json', data: structuredClone(spec) },
      { folderStrategy: 'Tags', parametersResolution: 'Example' },
      (err, res) => (err ? reject(err) : resolve(res)),
    ),
  );
  if (!result.result) throw new Error(`openapi-to-postmanv2: ${result.reason}`);
  const collection = result.output[0].data;
  delete collection.variable; // baseUrl comes from the environment
  walk(collection.item);
  stripIds(collection);
  return `${JSON.stringify(collection, null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const spec = JSON.parse(readFileSync(new URL('../services/core/openapi.json', import.meta.url), 'utf8'));
  writeFileSync(new URL('../docs/postman/shopperstop-core.postman_collection.json', import.meta.url), await generate(spec));
}
```

### The environment (`docs/postman/local.postman_environment.json`)

```json
{
  "name": "ShopperStop local",
  "values": [
    { "key": "baseUrl", "value": "http://localhost:8080/api/core/v1", "type": "default", "enabled": true },
    { "key": "customerToken", "value": "", "type": "secret", "enabled": true },
    { "key": "staffToken", "value": "", "type": "secret", "enabled": true },
    { "key": "storeId", "value": "", "type": "default", "enabled": true },
    { "key": "productId", "value": "", "type": "default", "enabled": true },
    { "key": "addressId", "value": "", "type": "default", "enabled": true },
    { "key": "orderId", "value": "", "type": "default", "enabled": true }
  ],
  "_postman_variable_scope": "environment"
}
```

### The test fixture (inline in `scripts/postman.test.mjs`)

A Phase 2 shaped contract: `openapi` `3.1.0`, `servers` `[{url: '/api/core/v1'}]`, `components.securitySchemes.bearer` `{type: 'http', scheme: 'bearer'}`, tags `accounts`, `orders`, `admin-staff`, and operations:

- `POST /auth/sign-in` (tag `accounts`, no security), request body example `{"email":"customer@example.com","password":"password123"}`, 200 example `{"token":"t","customer":{"id":"c1"}}`
- `POST /auth/sign-out` (tag `accounts`, bearer security), 204 with no content
- `GET /orders/{id}` (tag `orders`, bearer security), path parameter `id` with example `o1`, 200 example `{"id":"o1"}`
- `POST /admin/auth/sign-in` (tag `admin-staff`, no security), request body example, 200 example `{"token":"t","staff":{"id":"s1"}}`
- `GET /admin/me` (tag `admin-staff`, bearer security), 200 example `{"id":"s1"}`

Every operation has `summary` (used to find requests in the output) and `responses`. Use example addresses at `example.com` only (no personal data).

## Risks / Trade-offs

- **"Runs top to bottom against `make dev`" (Spec 1 §11) is not fully met by this change**: tokens are captured, ids are not. Either core's `seed-demo` uses fixed ids that go into the environment, or a later change adds capture scripts on list and create responses. Escalated to the owner; Phase 1 has no routes that need ids, so nothing is lost now.
- **Phase 2 auth depends on core declaring `security`** (Decision 3). Without it the collection silently has no auth on protected routes; the core contract test does not check `security`. Request to core.
- **Converter upgrade drift** (Decision 2): bounded by the exact pin and the lockfile.
- **The test is not in CI** (Decision 8): the reviewer and the manager run it on the landing.

## Files

All in the platform area: `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/shopperstop-core.postman_collection.json` (generated), `docs/postman/local.postman_environment.json`, this change's `tasks.md`.
