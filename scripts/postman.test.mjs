// Scenarios from openspec/changes/platform-postman/specs/platform/spec.md.
// Run by hand: node --test scripts/postman.test.mjs (not wired into make test or CI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('two runs give identical bytes with no generated ids', async () => {
  for (const spec of [realSpec, fixture]) {
    const first = await generate(spec);
    const second = await generate(spec);
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

test('environment holds the seven variables', () => {
  const env = JSON.parse(read('../docs/postman/local.postman_environment.json'));
  assert.deepEqual(env.values.map((v) => v.key), ['baseUrl', 'customerToken', 'staffToken', 'storeId', 'productId', 'addressId', 'orderId']);
  const byKey = Object.fromEntries(env.values.map((v) => [v.key, v.value]));
  assert.equal(byKey.baseUrl, 'http://localhost:8080/api/core/v1');
  for (const key of ['customerToken', 'staffToken']) assert.equal(byKey[key], '', `${key} must be empty`);
  // D20: the ids are the core seed's fixed uuids so the collection runs top to bottom against make dev.
  for (const key of ['storeId', 'productId', 'addressId', 'orderId']) assert.match(byKey[key], /^00000000-0000-4000-8000-0000000007?0[0-9]{2}$|^00000000-0000-4000-8000-[0-9a-f]{12}$/, `${key} must be a fixed seed uuid`);
});
