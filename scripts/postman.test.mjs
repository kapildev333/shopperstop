// Scenarios from openspec/changes/platform-postman/specs/platform/spec.md and
// openspec/changes/platform-rider-wiring/specs/platform/spec.md.
// Run by hand: node --test scripts/postman.test.mjs (not wired into make test or CI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generate } from './postman.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const realSpec = JSON.parse(read('../services/core/openapi.json'));
const committed = read('../docs/postman/shopperstop-core.postman_collection.json');

// Phase 2 shaped contract (design.md, test fixture).
const fixture = {
  openapi: '3.1.0',
  info: { title: 'fixture', version: '0.0.0' },
  servers: [{ url: '/api/core/v1' }],
  tags: [{ name: 'accounts' }, { name: 'orders' }, { name: 'admin-staff' }],
  components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
  paths: {
    '/auth/sign-in': {
      post: {
        summary: 'Sign in',
        tags: ['accounts'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' }, example: { email: 'customer@example.com', password: 'password123' } } },
        },
        responses: {
          200: { description: 'Signed in.', content: { 'application/json': { schema: { type: 'object' }, example: { token: 't', customer: { id: 'c1' } } } } },
        },
      },
    },
    '/auth/sign-out': {
      post: {
        summary: 'Sign out',
        tags: ['accounts'],
        security: [{ bearer: [] }],
        responses: { 204: { description: 'Signed out.' } },
      },
    },
    '/orders/{id}': {
      get: {
        summary: 'Order',
        tags: ['orders'],
        security: [{ bearer: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'o1' }],
        responses: {
          200: { description: 'The order.', content: { 'application/json': { schema: { type: 'object' }, example: { id: 'o1' } } } },
        },
      },
    },
    '/stores/{id}/products/{slug}': {
      get: {
        summary: 'Product at store',
        tags: ['catalog'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 's1' },
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' }, example: 'banana-robusta' },
        ],
        responses: {
          200: { description: 'The product.', content: { 'application/json': { schema: { type: 'object' }, example: { slug: 'banana-robusta' } } } },
        },
      },
    },
    '/admin/auth/sign-in': {
      post: {
        summary: 'Staff sign in',
        tags: ['admin-staff'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' }, example: { email: 'staff@example.com', password: 'password123' } } },
        },
        responses: {
          200: { description: 'Signed in.', content: { 'application/json': { schema: { type: 'object' }, example: { token: 't', staff: { id: 's1' } } } } },
        },
      },
    },
    '/admin/me': {
      get: {
        summary: 'Me',
        tags: ['admin-staff'],
        security: [{ bearer: [] }],
        responses: {
          200: { description: 'The staff member.', content: { 'application/json': { schema: { type: 'object' }, example: { id: 's1' } } } },
        },
      },
    },
  },
};

// Rider contract shaped like services/rider/openapi.json (design.md, test fixture).
const riderFixture = {
  openapi: '3.1.0',
  info: { title: 'rider fixture', version: '0.0.0' },
  servers: [{ url: '/api/rider/v1' }],
  tags: [{ name: 'platform' }, { name: 'rider-service' }, { name: 'deliveries' }],
  components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
  paths: {
    '/healthz': {
      get: {
        summary: 'Rider liveness',
        tags: ['platform'],
        responses: { 200: { description: 'Alive.', content: { 'application/json': { schema: { type: 'object' }, example: { status: 'ok' } } } } },
      },
    },
    '/auth/sign-in': {
      post: {
        summary: 'Rider sign in',
        tags: ['rider-service'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' }, example: { email: 'rider1-koramangala@shopperstop.local', password: 'rider12345' } } },
        },
        responses: {
          200: { description: 'Signed in.', content: { 'application/json': { schema: { type: 'object' }, example: { token: 't', rider: { id: 'r1' } } } } },
        },
      },
    },
    '/me': {
      get: {
        summary: 'Rider me',
        tags: ['rider-service'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'The rider.', content: { 'application/json': { schema: { type: 'object' }, example: { id: 'r1' } } } } },
      },
    },
    '/me/deliveries/{id}': {
      get: {
        summary: 'Delivery',
        tags: ['deliveries'],
        security: [{ bearer: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'd1' }],
        responses: { 200: { description: 'The delivery.', content: { 'application/json': { schema: { type: 'object' }, example: { id: 'd1' } } } } },
      },
    },
    '/admin/riders/{id}': {
      get: {
        summary: 'Rider for staff',
        tags: ['rider-service'],
        security: [{ bearer: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'r1' }],
        responses: { 200: { description: 'The rider.', content: { 'application/json': { schema: { type: 'object' }, example: { id: 'r1' } } } } },
      },
    },
    '/orders/{orderId}/delivery': {
      get: {
        summary: 'Order delivery',
        tags: ['deliveries'],
        security: [{ bearer: [] }],
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' }, example: 'o1' }],
        responses: { 200: { description: 'The delivery.', content: { 'application/json': { schema: { type: 'object' }, example: { id: 'd1' } } } } },
      },
    },
  },
};

// Every request in the collection, with its folder name, in document order.
function requests(items, folder = null) {
  return items.flatMap((item) => (item.item ? requests(item.item, item.name) : [{ ...item, folder }]));
}
const requestNamed = (collection, name) => {
  const found = requests(collection.item).filter((r) => r.name === name);
  assert.equal(found.length, 1, `expected exactly one request named ${name}`);
  return found[0];
};
const testScript = (item) => (item.event ?? []).filter((e) => e.listen === 'test').map((e) => e.script.exec.join('\n'));

test('folders follow the contract tags', async () => {
  const c = JSON.parse(await generate(realSpec));
  const tags = new Set(Object.values(realSpec.paths).flatMap((ops) => Object.values(ops).flatMap((op) => op.tags ?? [])));
  assert.deepEqual(new Set(c.item.map((f) => f.name)), tags);
  const folder = c.item.find((f) => f.name === 'platform').item;
  assert.deepEqual(folder.map((r) => r.name), ['Liveness', 'Readiness']);
  assert.deepEqual(folder.map((r) => [r.request.method, r.request.url.host, r.request.url.path]), [
    ['GET', ['{{baseUrl}}'], ['healthz']],
    ['GET', ['{{baseUrl}}'], ['readyz']],
  ]);
});

test('request carries its example body', async () => {
  const c = JSON.parse(await generate(fixture));
  assert.deepEqual(JSON.parse(requestNamed(c, 'Sign in').request.body.raw), { email: 'customer@example.com', password: 'password123' });
});

test('invalid contract is refused', async () => {
  const { openapi, ...withoutVersion } = fixture;
  await assert.rejects(generate(withoutVersion));
});

test('secured requests read the token for their audience', async () => {
  const c = JSON.parse(await generate(fixture));
  const order = requestNamed(c, 'Order').request.auth;
  assert.equal(order.type, 'bearer');
  assert.equal(order.bearer[0].value, '{{customerToken}}');
  const me = requestNamed(c, 'Me').request.auth;
  assert.equal(me.type, 'bearer');
  assert.equal(me.bearer[0].value, '{{staffToken}}');
});

test('public requests carry no auth', async () => {
  const c = JSON.parse(await generate(realSpec));
  for (const name of ['Liveness', 'Readiness']) {
    assert.ok(!requestNamed(c, name).request.auth, `${name} must carry no auth`);
  }
});

test('sign-in requests store the returned token', async () => {
  const c = JSON.parse(await generate(fixture));
  assert.deepEqual(testScript(requestNamed(c, 'Sign in')), ["pm.environment.set('customerToken', pm.response.json().token);"]);
  assert.deepEqual(testScript(requestNamed(c, 'Staff sign in')), ["pm.environment.set('staffToken', pm.response.json().token);"]);
  assert.deepEqual(testScript(requestNamed(c, 'Sign out')), []);
});

test('path ids read environment variables', async () => {
  const c = JSON.parse(await generate(fixture));
  const variables = requestNamed(c, 'Order').request.url.variable;
  assert.deepEqual(variables.map((v) => [v.key, v.value]), [['id', '{{orderId}}']]);
});

test('slug path variables keep their example value', async () => {
  const c = JSON.parse(await generate(fixture));
  const variables = requestNamed(c, 'Product at store').request.url.variable;
  assert.deepEqual(variables.map((v) => [v.key, v.value]), [['id', '{{storeId}}'], ['slug', 'banana-robusta']]);
});

test('rider URLs read the rider base URL', async () => {
  const text = await generate(riderFixture, 'rider');
  assert.ok(!text.includes('{{baseUrl}}'), 'rider collection must not mention {{baseUrl}}');
  const c = JSON.parse(text);
  for (const r of requests(c.item)) assert.deepEqual(r.request.url.host, ['{{riderBaseUrl}}'], r.name);
});

test('rider routes read their tokens', async () => {
  const c = JSON.parse(await generate(riderFixture, 'rider'));
  const bearer = (name) => requestNamed(c, name).request.auth?.bearer[0].value;
  assert.equal(bearer('Rider me'), '{{riderToken}}');
  assert.equal(bearer('Delivery'), '{{riderToken}}');
  assert.equal(bearer('Rider for staff'), '{{staffToken}}');
  assert.equal(bearer('Order delivery'), '{{customerToken}}');
  for (const name of ['Rider liveness', 'Rider sign in']) {
    assert.ok(!requestNamed(c, name).request.auth, `${name} must carry no auth`);
  }
});

test('rider sign-in stores riderToken', async () => {
  const c = JSON.parse(await generate(riderFixture, 'rider'));
  assert.deepEqual(testScript(requestNamed(c, 'Rider sign in')), ["pm.environment.set('riderToken', pm.response.json().token);"]);
});

test('rider and delivery ids read environment variables', async () => {
  const c = JSON.parse(await generate(riderFixture, 'rider'));
  const vars = (name) => requestNamed(c, name).request.url.variable.map((v) => [v.key, v.value]);
  assert.deepEqual(vars('Rider for staff'), [['id', '{{riderId}}']]);
  assert.deepEqual(vars('Delivery'), [['id', '{{deliveryId}}']]);
  assert.deepEqual(vars('Order delivery'), [['orderId', '{{orderId}}']]);
});

test('rider collection follows the rider contract', async () => {
  const contract = new URL('../services/rider/openapi.json', import.meta.url);
  const collection = '../docs/postman/shopperstop-rider.postman_collection.json';
  if (existsSync(contract)) {
    assert.equal(read(collection), await generate(JSON.parse(read('../services/rider/openapi.json')), 'rider'));
  } else {
    assert.equal(existsSync(new URL(collection, import.meta.url)), false, 'no rider collection without a rider contract');
  }
});

test('postman CLI skips an absent rider contract', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const stdout = execFileSync(process.execPath, ['scripts/postman.mjs'], { cwd: root, encoding: 'utf8' });
  if (existsSync(new URL('../services/rider/openapi.json', import.meta.url))) {
    assert.ok(!stdout.includes('services/rider/openapi.json absent'));
  } else {
    assert.ok(stdout.includes('postman: services/rider/openapi.json absent, skipping'), stdout);
  }
  assert.equal(read('../docs/postman/shopperstop-core.postman_collection.json'), committed);
});

test('two runs give identical bytes with no generated ids', async () => {
  for (const [spec, service] of [[realSpec, 'core'], [fixture, 'core'], [riderFixture, 'rider']]) {
    const first = await generate(spec, service);
    const second = await generate(spec, service);
    assert.equal(first, second);
    assert.ok(first.endsWith('\n'));
    const parsed = JSON.parse(first);
    assert.equal(parsed.variable, undefined);
    const keys = [];
    (function collect(node) {
      if (Array.isArray(node)) node.forEach(collect);
      else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) { keys.push(k); collect(v); }
      }
    })(parsed);
    assert.ok(!keys.includes('id') && !keys.includes('_postman_id'), 'generated ids must be stripped');
  }
});

test('committed collection matches the contract', async () => {
  assert.equal(committed, await generate(realSpec));
});

test('environment holds the eleven variables', () => {
  const env = JSON.parse(read('../docs/postman/local.postman_environment.json'));
  assert.deepEqual(env.values.map((v) => v.key), [
    'baseUrl', 'customerToken', 'staffToken', 'storeId', 'productId', 'addressId', 'orderId',
    'riderBaseUrl', 'riderToken', 'riderId', 'deliveryId',
  ]);
  const byKey = Object.fromEntries(env.values.map((v) => [v.key, v.value]));
  const byType = Object.fromEntries(env.values.map((v) => [v.key, v.type]));
  assert.equal(byKey.baseUrl, 'http://localhost:8080/api/core/v1');
  assert.equal(byKey.riderBaseUrl, 'http://localhost:8081/api/rider/v1');
  for (const key of ['customerToken', 'staffToken', 'riderToken']) {
    assert.equal(byKey[key], '', `${key} must be empty`);
    assert.equal(byType[key], 'secret', `${key} must be secret`);
  }
  // D20: the ids are the core seed's fixed uuids so the collection runs top to bottom against make dev.
  for (const key of ['storeId', 'productId', 'addressId', 'orderId']) assert.match(byKey[key], /^00000000-0000-4000-8000-0000000007?0[0-9]{2}$|^00000000-0000-4000-8000-[0-9a-f]{12}$/, `${key} must be a fixed seed uuid`);
  // The rider seed's first Koramangala rider and the demo delivery (.claude/areas/rider.md).
  assert.equal(byKey.riderId, '00000000-0000-4000-8000-000000000801');
  assert.equal(byKey.deliveryId, '00000000-0000-4000-8000-000000000901');
});
